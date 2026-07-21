/**
 * Musical Variation layer types (design §3-2). The Variation layer is the MIDDLE of
 * the three-layer pipeline — Groove Template → **Musical Variation** → Micro
 * Humanization. It rewrites the deterministic grid strikes with *intentful* musical
 * change (rests, ties, anticipation emphasis, 2/4-bar variation, phrase fills,
 * bass-only bars) BEFORE any random micro-jitter, so the result reads as a player
 * making choices rather than a machine sprayed with noise.
 *
 * A `VariationProfile` is pure data: each rule carries its own firing probability and
 * a hard per-phrase cap so no single phrase is over-processed (design: "毎小節すべては
 * 適用しない / 変化させすぎてパターン特徴を失わない上限"). Everything is seed-derived and
 * range/probability-limited — never `Math.random` — so the same seed reproduces the
 * same performance.
 */

/** A rule that fires with `probability` per candidate, capped at `maxPerPhrase`. */
export interface CappedRule {
  /** 0..1 chance the rule fires on each eligible candidate. */
  probability: number;
  /** Hard upper bound on how many times this rule may fire within one 4-bar phrase. */
  maxPerPhrase: number;
}

/** Tuning for the whole Variation layer — one profile per Feel (design §3-1). */
export interface VariationProfile {
  /** Drop weak-beat chord strikes to open up space (strong beats/bar heads protected). */
  rests: CappedRule;
  /**
   * Tie a syncopated (off-beat) chord over the following strong beat: the down-beat
   * re-attack is suppressed and the off-beat note is held across the boundary.
   */
  ties: CappedRule;
  /** On the 2nd & 4th bar of each phrase, add or drop a single stab (light variation). */
  twoFourBar: CappedRule;
  /** Phrase-end fill: sustain the final chord and/or add a small pickup. */
  phraseFill: {
    /** Sustain the final chord of the progression (long ring at the end). */
    sustainFinal: boolean;
    /** Chance of adding a single extra chord stab late in a phrase's last bar. */
    extraStabProbability: number;
  };
  /** Rarely drop a whole bar's chord, leaving only the bass (never the first/last bar). */
  bassOnly: CappedRule;
}

/** Musical context the rules reason about (phrase = 4 bars by pop convention). */
export interface VariationContext {
  /** Number of bars in the progression. */
  bars: number;
  beatsPerBar: number;
  stepsPerBar: number;
  /** Phrase length in bars (4 by default — the pop phrase). */
  phraseLength: number;
  bpm: number;
}
