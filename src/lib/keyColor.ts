import type { ChordEvent, MajorKey } from '@/types';

/**
 * Key color assignment (pure domain, UI/Expo independent).
 *
 * A progression can span multiple keys (modulation): each `ChordEvent` carries
 * an optional `keyContext`. To visualize this we assign each distinct key a
 * stable "color slot" by order of first appearance:
 *   - slot 0 = the first key encountered → the neutral/base key (no tint),
 *   - slot 1, 2, … = subsequent keys → tinted so modulations stand out.
 *
 * Slots are deterministic and independent of the session key, so they work for
 * any modulation shape. The actual colors live in the theme layer; this module
 * only decides which slot each key/event maps to.
 */

/** The key a chord's degree label is read in (falls back to the session key). */
export function eventKey(event: ChordEvent, fallback: MajorKey): MajorKey {
  return event.keyContext ?? fallback;
}

/** Distinct key contexts in order of first appearance. */
export function distinctKeys(progression: readonly ChordEvent[], fallback: MajorKey): MajorKey[] {
  const seen: MajorKey[] = [];
  for (const e of progression) {
    const k = eventKey(e, fallback);
    if (!seen.includes(k)) seen.push(k);
  }
  return seen;
}

/** Map each key context to a stable color slot (0 = base) by first appearance. */
export function keyColorSlots(
  progression: readonly ChordEvent[],
  fallback: MajorKey,
): Map<MajorKey, number> {
  return new Map(distinctKeys(progression, fallback).map((k, i) => [k, i]));
}

/** True when the progression spans more than one key context. */
export function isMultiKey(progression: readonly ChordEvent[], fallback: MajorKey): boolean {
  return distinctKeys(progression, fallback).length > 1;
}
