import { can, type Entitlements } from '@/lib/entitlements';
import type { MajorKey } from '@/types';

/**
 * Key access gating (pure domain, UI/Expo independent).
 *
 * Free tier is limited to **C major**. Selecting or transposing to any other
 * key is a Palette Pro feature (product decision 2026-07-21). Moving *to* a
 * free key (e.g. back to C) is always allowed so a lapsed/free user can never
 * get stuck in a locked key.
 *
 * Presets carry no absolute key — they render in the current session key
 * (`startFromPreset`), so a free user's presets always sound in C. Only saved
 * projects can carry a non-C key; loading/playing those is not gated here,
 * only *changing* the key is.
 *
 * `FREE_KEYS` is an array so the free set can be widened later (e.g. add a
 * couple of common keys) without touching call sites.
 */
export const FREE_KEYS: readonly MajorKey[] = ['C'];

/** Whether `key` is playable/selectable without Palette Pro. */
export function isKeyFree(key: MajorKey): boolean {
  return FREE_KEYS.includes(key);
}

/** True when selecting/transposing to `key` requires Palette Pro. */
export function isKeyLocked(key: MajorKey, entitlements: Entitlements): boolean {
  return !isKeyFree(key) && !can(entitlements, 'key.transpose');
}
