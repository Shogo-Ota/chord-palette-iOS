/**
 * Bass-line planning types (implementation_v1.01 Phase 7).
 *
 * A bass line is planned per CHORD SEGMENT — one figure for the stretch a chord
 * root holds — never one global rule for the whole song, so no two chords are
 * forced into the same movement. The five moves the spec requires:
 *
 *   root / fifth / octave = stable chord tones (strong beats always take root),
 *   passing / approach    = short out-of-chord connectives allowed ONLY on the
 *                           last hit before a root change.
 */

/** How the strikes inside one chord segment move between stable tones. */
export type BassFigure = 'rootOnly' | 'rootFifth' | 'rootOctave';

/** A rhythm's bass movement character. */
export interface BassProfile {
  /** Figures a segment may draw (picked per segment from the seed). */
  figures: readonly BassFigure[];
  /** Probability the last hit before a root change becomes an approach note. */
  approachChance: number;
  /** Allow a scale-wise passing tone when the roots are a third apart. */
  passing: boolean;
}
