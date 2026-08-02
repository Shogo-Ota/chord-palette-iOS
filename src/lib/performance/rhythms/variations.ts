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

/**
 * 8-beat: light space; the bar itself carries the groove. Band Engine v1
 * (band_engine_spec §9): the phrase END pushes forward instead of landing —
 * no final ring, more pickup stabs into the next phrase (Ballad's opposite).
 */
export const EIGHT_VARIATION: VariationProfile = {
  rests: { probability: 0.14, maxPerPhrase: 2 },
  ties: { probability: 0.22, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.5, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: false, extraStabProbability: 0.55 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

/**
 * 16-beat: the grid is already busy, so Variation opens holes rather than adding
 * stabs — a rest in a 16th lattice is what makes the groove, not denser hits.
 */
export const SIXTEEN_VARIATION: VariationProfile = {
  rests: { probability: 0.22, maxPerPhrase: 3 },
  ties: { probability: 0.18, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.55, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: false, extraStabProbability: 0.5 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

/** Shuffle / swing: keep the long-short pulse intact; change the bar, not the hop. */
export const SWUNG_VARIATION: VariationProfile = {
  rests: { probability: 0.16, maxPerPhrase: 2 },
  ties: { probability: 0.28, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.4, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.35 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

/** Bossa / reggae: space is the character — rest more, stab less. */
export const SPACE_VARIATION: VariationProfile = {
  rests: { probability: 0.2, maxPerPhrase: 2 },
  ties: { probability: 0.25, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.35, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.3 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

/** 6/8 and waltz: keep the meter readable — light variation, no dropped bars. */
export const METERED_VARIATION: VariationProfile = {
  rests: { probability: 0.1, maxPerPhrase: 1 },
  ties: { probability: 0.2, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.3, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0.25 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};
