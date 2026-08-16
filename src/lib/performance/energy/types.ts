/**
 * Style × Energy Level (v1.01) — domain types.
 * DESIGN_TARGET profiles control how an existing rhythm is "played", not which
 * rhythm skeleton is used. Labels are user-facing 「盛り上がり」; internals are
 * verse / build / chorus.
 */

/** Internal energy ids (independent of Style). Default: build. */
export type AccompanimentEnergy = 'verse' | 'build' | 'chorus';

/**
 * Per Style×Energy knobs. Not a uniform gain: each field targets a musical role.
 * Scales are relative to the unresolved style skeleton (1 = unchanged).
 * Deltas are absolute MIDI / step / semitone adjustments.
 */
export interface EnergyProfile {
  /** Thin / densify chord-body grid hits (prefer weak accents when thinning). */
  noteDensity: number;
  /** Accent / re-attack emphasis on chord hits (Band chorus attack, etc.). */
  attackDensity: number;
  /** Added to chord velocity center (bass/drums use their own activity scales). */
  velocityDelta: number;
  /** Semitones applied to chord + top only (bass stays put to avoid mud). */
  registerOffset: number;
  /** Extra chord tones bias via topEmphasis / accentDepth (voicing "width" proxy). */
  voicingWidthDelta: number;
  /** Reserved for future body-note count; currently folds into topEmphasis. */
  polyphonyDelta: number;
  /** Multiplies gate min/max (Ballad verse longer, etc.). */
  gateScale: number;
  /** Scales Variation rests / bassOnly (higher = more silence). */
  restRatioScale: number;
  /** Scales off-beat / syncopation-ish variation (ties, anticipation leave as-is). */
  syncopationScale: number;
  /** Scales twoFourBar / phraseFill activity. */
  phraseVariationScale: number;
  /** Bass hit density + approach probability boost. */
  bassActivityScale: number;
  /** Kit hit density (hat strongest; kick/snare milder). */
  drumActivityScale: number;
  /** Multiplier on style topEmphasis (default 3 → scaled). */
  topNoteEmphasisScale: number;
  /** Optional Style-specific extras (DESIGN_TARGET). Not yet consumed by the generator. */
  fillProbability?: number;
  openHatProbability?: number;
  crashProbability?: number;
  bassApproachProbability?: number;
  /** Phrase-end intent: space vs push (feeds phraseFill sustain / stab). */
  phraseEnd?: 'space' | 'neutral' | 'push';
}

/** Neutral profile: leaves the resolved style skeleton unchanged. */
export const IDENTITY_ENERGY: EnergyProfile = {
  noteDensity: 1,
  attackDensity: 1,
  velocityDelta: 0,
  registerOffset: 0,
  voicingWidthDelta: 0,
  polyphonyDelta: 0,
  gateScale: 1,
  restRatioScale: 1,
  syncopationScale: 1,
  phraseVariationScale: 1,
  bassActivityScale: 1,
  drumActivityScale: 1,
  topNoteEmphasisScale: 1,
  phraseEnd: 'neutral',
};

export const DEFAULT_ENERGY: AccompanimentEnergy = 'build';

export const ENERGY_IDS: readonly AccompanimentEnergy[] = ['verse', 'build', 'chorus'];

/** User-facing labels for the segmented control. */
export const ENERGY_LABELS: Record<AccompanimentEnergy, string> = {
  verse: 'Aメロっぽく',
  build: 'Bメロっぽく',
  chorus: 'サビっぽく',
};

/** Short helper shown only while selected. */
export const ENERGY_HINTS: Record<AccompanimentEnergy, string> = {
  verse: '控えめ・余白多め',
  build: '少し動きを加える',
  chorus: 'しっかり盛り上げる',
};
