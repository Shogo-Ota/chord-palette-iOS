/**
 * Variation profiles for the authored rhythms.
 *
 * The three feels tune their own profiles in `feel/profiles.ts`; these belong to the
 * rhythms that own a skeleton outright. They are separate tables rather than reused
 * feel profiles because a rhythm's identity lives in its bar, and the Variation layer
 * is what keeps that bar from repeating verbatim — how much space an 8-beat can lose
 * before it stops driving is not the same question as it is for a ballad.
 *
 * One rule holds across all of them: `bassOnly` stays at zero. A bass-only bar is a
 * musical breather the feels can afford because the player chose a *feel*; a player
 * who picked a named rhythm asked for that rhythm's chords, and dropping them reads
 * as a dropout rather than a choice.
 */

import type { VariationProfile } from '../variation/types';

/** 8-beat: light space and a phrase-end ring; the bar itself carries the groove. */
export const EIGHT_VARIATION: VariationProfile = {
  rests: { probability: 0.14, maxPerPhrase: 2 },
  ties: { probability: 0.22, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.45, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.4 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};
