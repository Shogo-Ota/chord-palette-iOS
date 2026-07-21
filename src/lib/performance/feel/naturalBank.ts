/**
 * Natural Feel groove **bank** + deterministic phrase picker.
 *
 * The Natural feel is no longer a single template: it is a small bank of comp
 * templates distilled from the Good Song Top 10 MIDI, all sharing the SAME straight
 * quarter-note chord body, drum skeleton, gate, velocity and microtiming — they differ
 * ONLY in the bass rhythm (and its accents). The Performance Engine rotates through the
 * bank one 4-bar phrase at a time so a long Natural performance breathes and re-phrases
 * like a real player instead of looping one bar forever.
 *
 * The rotation is fully deterministic (design §1 / §6: same seed ⇒ same performance):
 * each phrase draws one value from `streamFor(seed, 'naturalBank', phraseIndex)` — never
 * `Math.random` — so the same `(seed, phraseIndex)` always yields the same template, and
 * the same seed always reproduces the whole rotation. Pure, UI/RN/Expo/native-free.
 *
 * The three members (see the individual style files for the MIDI provenance):
 *  - A `naturalComp`        — quarters + walking & bass (every &: steps 1,3,5,7).
 *  - B `naturalCompSparse`  — quarters + sparse bass (&of2 / &of4 only: steps 3,7).
 *  - C `naturalCompDense`   — quarters + dense bass (steps 1,2,5,6,7; the only member
 *                             that puts a bass note on beat 2).
 */

import { streamFor } from '../rng';
import { NATURAL_COMP } from '../styles/naturalComp';
import { NATURAL_COMP_DENSE } from '../styles/naturalCompDense';
import { NATURAL_COMP_SPARSE } from '../styles/naturalCompSparse';
import type { StylePreset } from '../styles/types';

/**
 * The Natural comp bank, in provenance order. `NATURAL_BANK[0]` is the original
 * `naturalComp` (A) — kept first so `resolveFeel('natural')` stays backward compatible
 * (it still resolves to A for its template-level fields).
 */
export const NATURAL_BANK: readonly StylePreset[] = [
  NATURAL_COMP,
  NATURAL_COMP_SPARSE,
  NATURAL_COMP_DENSE,
] as const;

/**
 * Deterministically pick the comp template for a given 4-bar phrase.
 *
 * `index = floor(u * bank.length)` where `u ∈ [0, 1)` comes from a seed-derived stream
 * keyed by the phrase index, so:
 *  - same `(seed, phraseIndex)` ⇒ same template (reproducible), and
 *  - consecutive phrases draw from independent streams ⇒ the template can change from
 *    one phrase to the next (the rotation), while a short (single-phrase) progression
 *    still gets a stable, seed-defined choice.
 *
 * `u` is in `[0, 1)` so `floor(u * length)` is always a valid index; the `min` clamp is
 * defensive only (guards against a `u` of exactly 1 from any future rng change).
 */
export function pickNaturalTemplate(
  seed: number,
  phraseIndex: number,
  bank: readonly StylePreset[] = NATURAL_BANK,
): StylePreset {
  if (bank.length === 0) throw new Error('pickNaturalTemplate: empty bank');
  const u = streamFor(seed, 'naturalBank', phraseIndex).next();
  const index = Math.min(bank.length - 1, Math.floor(u * bank.length));
  return bank[index];
}
