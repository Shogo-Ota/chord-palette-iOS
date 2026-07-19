import { useSyncExternalStore } from 'react';

import { ADMIN_UNLOCK } from '@/config/admin';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { logger } from '@/lib/logger';

import type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';
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

function getSnapshot(): Entitlements {
  return current;
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
  return current;
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

// Default provider = Mock (Phase 5A). Seeded with the admin-aware initial state.
wireProvider(new MockBillingProvider({ initial: current }));

/**
 * TEST ONLY: swap the billing provider (e.g. inject a preconfigured Mock).
 * Re-wires the entitlement subscription so `useEntitlements()` tracks the new one.
 */
export function __setBillingProviderForTests(next: BillingProvider): void {
  wireProvider(next);
}

/* ------------------------------------------------------------------ */
/* Analytics (stub — forwarded to PostHog in M4)                       */
/* ------------------------------------------------------------------ */

/**
 * Analytics stub. Purchase-funnel events are logged only (no PostHog yet, M4).
 * Never sends project titles, notes, chord progressions, or video content (§5.12).
 */
function track(event: string, props?: Record<string, unknown>): void {
  logger.info(`analytics:${event}`, props);
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
