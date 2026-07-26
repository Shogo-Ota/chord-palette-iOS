import { can, type Entitlements } from '@/lib/entitlements';
import type { MajorKey } from '@/types';

/**
 * Key access gating (pure domain, UI/Expo independent).
 *
 * Every major key is now free. The tier previously held all but C major, which
 * meant a free player could not write in the key they sing in — a restriction
 * that blocked the app's core use rather than reserving something extra.
 *
 * The gate stays wired to the `key.transpose` capability instead of being deleted,
 * so the decision lives with the rest of the free/paid boundary and can be read
 * (or revisited) in one place. `FREE_KEYS` is the floor underneath that: even with
 * the capability withdrawn, moving *to* one of these is always allowed, so nobody
 * can get stranded in a key they are not entitled to change out of.
 *
 * Presets carry no absolute key — they render in the current session key
 * (`startFromPreset`). Only saved projects carry a key; loading and playing those
 * is not gated here, only *changing* the key is.
 */
export const FREE_KEYS: readonly MajorKey[] = ['C'];

/** Whether `key` is reachable even without the transpose capability. */
export function isKeyFree(key: MajorKey): boolean {
  return FREE_KEYS.includes(key);
}

/** True when selecting/transposing to `key` requires Palette Pro. */
export function isKeyLocked(key: MajorKey, entitlements: Entitlements): boolean {
  return !isKeyFree(key) && !can(entitlements, 'key.transpose');
}
