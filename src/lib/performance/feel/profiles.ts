/**
 * Per-feel Musical Variation profiles (design §3-1 → §3-2). These are the intentful
 * "how much / how often" knobs each feel dials in. Kept as plain data (no logic) so a
 * feel is tuned by editing a table, not code:
 *
 *  - Natural  — Good Song Top 10 distill: straight quarter comps, moderate space,
 *    light 2/4-bar twist, phrase-end ring. Balanced humanizeScale (templates).
 *  - Driving  — forward motion via SPACE + SYNCOPATION: more rests punch holes the
 *    off-beat top voice fills, so the comp pushes ahead instead of sitting on the
 *    beat. Short (few ties) 2/4-bar stabs + phrase pickups; no bass-only breathers.
 *  - Relaxed  — laid-back: lots of space (rests) and long ties, gentle fills, the odd
 *    bass-only bar. Fewest notes of the three.
 */

import type { VariationProfile } from '../variation/types';
import type { FeelId } from './types';

export const NATURAL_VARIATION: VariationProfile = {
  rests: { probability: 0.18, maxPerPhrase: 2 },
  ties: { probability: 0.3, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.4, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.35 },
  bassOnly: { probability: 0.06, maxPerPhrase: 1 },
};

// Driving = 疾走感: rests punch holes (space) that the off-beat top voice answers
// (syncopation), so the groove drives forward rather than plodding on the beats.
export const DRIVING_VARIATION: VariationProfile = {
  rests: { probability: 0.2, maxPerPhrase: 2 },
  ties: { probability: 0.12, maxPerPhrase: 1 },
  twoFourBar: { probability: 0.62, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: false, extraStabProbability: 0.62 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

// Relaxed = laid-back but slightly fuller than before (a touch fewer rests/ties and
// bass-only bars) so a few more notes sing without losing the space.
export const RELAXED_VARIATION: VariationProfile = {
  rests: { probability: 0.26, maxPerPhrase: 2 },
  ties: { probability: 0.38, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.25, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.28 },
  bassOnly: { probability: 0.1, maxPerPhrase: 1 },
};

export const VARIATION_BY_FEEL: Record<FeelId, VariationProfile> = {
  natural: NATURAL_VARIATION,
  driving: DRIVING_VARIATION,
  relaxed: RELAXED_VARIATION,
};
