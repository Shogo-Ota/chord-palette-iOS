import { useSyncExternalStore } from 'react';

import { ADMIN_UNLOCK } from '@/config/admin';
import { isAdminMode, subscribeAdminMode } from '@/features/admin/adminMode';
import { env } from '@/lib/env';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { logger } from '@/lib/logger';
import type { Tier } from '@/lib/performance/tier';
import { track as trackEvent, type AnalyticsEvent, type AnalyticsProps } from '@/services/analytics';

import type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';
import { DisabledBillingProvider } from './DisabledBillingProvider';
import { MockBillingProvider } from './MockBillingProvider';

/**
 * Billing service (Phase 5A — Mock先行).
 *
 * Screens/UI depend ONLY on `useEntitlements()` / `getEntitlements()` and on
 * `billingService` (never on a concrete provider), so the provider can be swapped
 * (Mock → RevenueCat in Phase 5B) without touching any screen. The service holds a
 * single injected `BillingProvider` and mirrors its entitlement state into the
 * existing `useSyncExternalStore` snapshot used across the app.
 *
 * Client-side entitlement is provisional; permanent verification is server-side
 * (Convex) in Phase 4. The store / subscription platform is the source of truth.
 */
const ALL_ENTITLEMENTS: Entitlements = { palettePro: true, communityPlus: true };

// Admin/owner builds start fully unlocked (see src/config/admin.ts). Everyone
// else starts with no entitlements until a real subscription is resolved.
let current: Entitlements = ADMIN_UNLOCK ? ALL_ENTITLEMENTS : NO_ENTITLEMENTS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Entitlements as seen by the app. Admin/owner mode (entered via a hidden gesture
 * on the home screen) unlocks every Pro feature in ALL builds — the owner wants
 * full access without a purchase. `ALL_ENTITLEMENTS` is a stable constant so
 * `useSyncExternalStore` never sees a new reference (no render loop).
 */
function effectiveEntitlements(): Entitlements {
  return isAdminMode() ? ALL_ENTITLEMENTS : current;
}

function getSnapshot(): Entitlements {
  return effectiveEntitlements();
}

/**
 * DEV ONLY: override entitlements to preview Pro-gated UI without a purchase.
 * Independent of the billing provider; superseded by real state once the provider
 * emits. Do not use in production flows.
 */
export function __setEntitlementsForDev(next: Partial<Entitlements>): void {
  current = { ...current, ...next };
  emit();
}

/** Reactive entitlements for components. */
export function useEntitlements(): Entitlements {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-reactive read for imperative code paths. */
export function getEntitlements(): Entitlements {
  return effectiveEntitlements();
}

/**
 * Monetization tier derived from the current entitlements: Palette Pro → `pro`,
 * otherwise `free`. Used by playback / export to pick the humanize/strum strength
 * (see `lib/performance/tier.ts`). Non-reactive read for imperative code paths.
 */
export function getTier(): Tier {
  return effectiveEntitlements().palettePro ? 'pro' : 'free';
}

/** Reactive tier for components (mirrors {@link getTier}). */
export function useTier(): Tier {
  return useEntitlements().palettePro ? 'pro' : 'free';
}

/* ------------------------------------------------------------------ */
/* Provider wiring (dependency injection)                              */
/* ------------------------------------------------------------------ */

let provider: BillingProvider;
let unsubscribeProvider: (() => void) | null = null;

/** Point the service at a provider and mirror its entitlements into the store. */
function wireProvider(next: BillingProvider): void {
  unsubscribeProvider?.();
  provider = next;
  current = next.getEntitlements();
  unsubscribeProvider = next.onEntitlementsChange((e) => {
    current = e;
    emit();
  });
  emit();
}

/**
 * Choose the concrete provider for this build:
 * - Real RevenueCat billing in store builds (production/preview) when an iOS API key
 *   is present. `react-native-purchases` is loaded via `require` *inside* this branch
 *   so it never enters the dev/Metro or jest module graph (keeps unit tests pure and
 *   dev builds independent of the native SDK).
 * - Mock everywhere else (dev/test, or any build missing the key) so the paywall stays
 *   exercisable without the store.
 */
function createDefaultProvider(): BillingProvider {
  if (!__DEV__ && env.revenueCatIosKey) {
    try {
      // Lazy load: keeps react-native-purchases out of the dev/Metro and jest graph.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./RevenueCatBillingProvider') as typeof import('./RevenueCatBillingProvider');
      return new mod.RevenueCatBillingProvider(env.revenueCatIosKey);
    } catch (e) {
      logger.error('RevenueCat provider unavailable; falling back to Mock', {
        error: String(e),
      });
    }
  }
  // Misconfiguration guard: a store build (non-dev) MUST ship with the RevenueCat key.
  // If it is missing we must NOT fall back to the Mock (which would "unlock" Pro for
  // free and ship a non-functional IAP). Degrade safely to a provider that grants
  // nothing and fails purchases, and surface it loudly so QA catches it pre-submission.
  if (!__DEV__ && !env.revenueCatIosKey) {
    logger.error(
      'Production build is missing EXPO_PUBLIC_REVENUECAT_IOS_KEY — billing disabled (no free unlock)',
    );
    return new DisabledBillingProvider();
  }
  // Dev / test (or any Metro build): Mock so the paywall stays exercisable without the store.
  return new MockBillingProvider({ initial: current });
}

// Default provider (admin-aware initial state seeds the Mock fallback).
wireProvider(createDefaultProvider());

// Mirror admin-mode toggles into the entitlement store: when the owner enters or
// leaves admin mode, re-notify subscribers so Pro-gated UI unlocks/re-locks live.
subscribeAdminMode(() => emit());

/**
 * TEST ONLY: swap the billing provider (e.g. inject a preconfigured Mock).
 * Re-wires the entitlement subscription so `useEntitlements()` tracks the new one.
 */
export function __setBillingProviderForTests(next: BillingProvider): void {
  wireProvider(next);
}

/* ------------------------------------------------------------------ */
/* Analytics (purchase funnel → PostHog)                               */
/* ------------------------------------------------------------------ */

/**
 * Forward a purchase-funnel event to analytics (and a local log). Never sends project
 * titles, notes, chord progressions, or video content (§5.12) — only the safe metadata
 * passed by the callers below (productId / reason).
 */
function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  logger.info(`analytics:${event}`, props);
  trackEvent(event, props);
}

/* ------------------------------------------------------------------ */
/* Public service (screens call this — never a concrete provider)      */
/* ------------------------------------------------------------------ */

export const billingService = {
  /** Initialize the provider once at app startup and resolve current state. */
  async initBilling(): Promise<void> {
    try {
      await provider.init();
      current = provider.getEntitlements();
      emit();
    } catch (e) {
      logger.error('Billing init failed', { error: String(e) });
    }
  },

  /** Displayable subscription products (localized price). */
  getOfferings(): Promise<BillingProduct[]> {
    return provider.getOfferings();
  },

  /** Subscribe to Palette Pro. Emits purchase-funnel analytics. */
  async purchasePro(): Promise<BillingResult> {
    track('palette_pro_purchase_started', { productId: 'palette_pro_monthly' });
    try {
      const result = await provider.purchasePro();
      if (result.status === 'purchased') {
        track('palette_pro_purchased', { productId: 'palette_pro_monthly' });
      } else if (result.status === 'error') {
        track('palette_pro_purchase_failed', { reason: result.message });
      }
      // 'cancelled' is a user action — intentionally not a failure event (§5.12).
      return result;
    } catch (e) {
      const message = String(e);
      track('palette_pro_purchase_failed', { reason: message });
      return { status: 'error', message };
    }
  },

  /** Restore a previously purchased subscription. */
  async restore(): Promise<BillingResult> {
    try {
      const result = await provider.restore();
      if (result.status === 'restored' || result.status === 'purchased') {
        track('purchase_restored', { productId: 'palette_pro_monthly' });
      }
      return result;
    } catch (e) {
      return { status: 'error', message: String(e) };
    }
  },
};

export type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';
