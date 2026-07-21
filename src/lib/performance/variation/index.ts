/**
 * Musical Variation layer entry point (design §3-2). Composes the individual rule
 * Strategies in a fixed, deterministic order between the Groove Template
 * (`collectStrikes`) and Micro Humanization (`renderTrack`):
 *
 *   rests → ties → twoFourBar → phraseFill → bassOnly → ensureChordFloor
 *
 * The final `ensureChordFloor` pass is a safety net (not a musical rule): it
 * restores a bar-head chord strike for any bar the rules left with no harmony at
 * all, so a deterministic breather can never read as "that chord never plays".
 *
 * Each rule is a single-responsibility pure transform gated by its own probability
 * and per-phrase cap, so no single phrase is over-processed and the groove keeps its
 * identity. The whole thing is a pure function of `(strikes, style, ctx, profile,
 * seed)` — same seed ⇒ identical rewrite — because every random decision comes from
 * `streamFor(seed, 'var', <rule>, …)`.
 */

import type { StrikesByTrack } from '../strike';
import type { StylePreset } from '../styles/types';
import { applyBassOnly } from './bassOnly';
import { ensureChordFloor } from './ensureChordFloor';
import { cloneStrikes, sortStrikes } from './helpers';
import { applyPhraseFill } from './phraseFill';
import { applyRests } from './rests';
import { applyTies } from './ties';
import { applyTwoFourBar } from './twoFourBar';
import type { VariationContext, VariationProfile } from './types';

export * from './types';

/**
 * Apply the Variation profile to a set of grid strikes. Returns a NEW map (the input
 * is never mutated); track strike lists are re-sorted into grid order afterwards so
 * the engine's nominal-length computation stays correct.
 */
export function applyVariation(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  profile: VariationProfile,
  seed: number,
): StrikesByTrack {
  const out = cloneStrikes(strikes);

  applyRests(out, style, ctx, profile.rests, seed);
  applyTies(out, style, ctx, profile.ties, seed);
  applyTwoFourBar(out, style, ctx, profile.twoFourBar, seed);
  applyPhraseFill(out, style, ctx, profile.phraseFill, seed);
  applyBassOnly(out, style, ctx, profile.bassOnly, seed);

  // Safety net: never let a whole bar lose its harmony. Restores the bar-head
  // chord strike for any bar the rules above left chord-less (design §3-2).
  ensureChordFloor(strikes, out);

  for (const track of Object.keys(out) as (keyof StrikesByTrack)[]) {
    const list = out[track];
    if (list) out[track] = sortStrikes(list);
  }
  return out;
}
