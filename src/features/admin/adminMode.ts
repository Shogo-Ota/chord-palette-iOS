/**
 * Operator/admin mode — a tiny external store (same pattern as the editor
 * session). When ON it (a) reveals the preset-authoring UI and (b) grants full
 * Pro entitlements to the owner (see `services/billing`, which subscribes to this
 * store). Persisted to `app_meta` so it survives restarts. Entered via a hidden
 * gesture on the home screen (a private tap sequence — no visible affordance),
 * so casual users can't reach it.
 */

import { useSyncExternalStore } from 'react';

import { getAdminModePref, setAdminModePref } from '@/repositories/sessionPrefsRepository';

let isAdmin = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Subscribe to admin-mode changes from non-React code (e.g. the billing service,
 * which mirrors admin state into its entitlement store). Returns an unsubscribe.
 */
export function subscribeAdminMode(cb: () => void): () => void {
  return subscribe(cb);
}

function getSnapshot(): boolean {
  return isAdmin;
}

/** Reactive hook for components. */
export function useAdminMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-reactive read. */
export function isAdminMode(): boolean {
  return isAdmin;
}

/** Hydrate from persistence once (safe to call on every screen mount). */
export async function loadAdminMode(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await getAdminModePref();
  if (stored !== isAdmin) {
    isAdmin = stored;
    emit();
  }
}

export async function setAdminMode(next: boolean): Promise<void> {
  if (next === isAdmin) return;
  isAdmin = next;
  loaded = true;
  emit();
  await setAdminModePref(next);
}

/** Flip admin mode and return the new value. */
export async function toggleAdminMode(): Promise<boolean> {
  await setAdminMode(!isAdmin);
  return isAdmin;
}
