import { useSyncExternalStore } from 'react';

import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

/**
 * Billing service (Phase 1 mock). Real entitlement resolution via RevenueCat +
 * Convex webhook sync lands in Phase 4; feature/UI code should depend only on
 * `useEntitlements()` / `getEntitlements()` so the implementation can be swapped
 * without touching screens.
 */
let current: Entitlements = NO_ENTITLEMENTS;
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
