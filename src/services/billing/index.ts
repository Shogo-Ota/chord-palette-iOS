import { useSyncExternalStore } from 'react';

import { ADMIN_UNLOCK } from '@/config/admin';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

/**
 * Billing service (Phase 1 mock). Real entitlement resolution via RevenueCat +
 * Convex webhook sync lands in Phase 4; feature/UI code should depend only on
 * `useEntitlements()` / `getEntitlements()` so the implementation can be swapped
 * without touching screens.
 */
const ALL_ENTITLEMENTS: Entitlements = { palettePro: true, communityPlus: true };

// Admin/owner builds start fully unlocked (see src/config/admin.ts). Everyone
// else starts with no entitlements until a real purchase is resolved.
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
 * Replaced by real RevenueCat state in Phase 4.
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
