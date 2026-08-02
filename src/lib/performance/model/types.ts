/**
 * Accompaniment axis model (implementation_v1.01 Phase 2).
 *
 * v1.01 keeps the thirteen-rhythm selector exactly as it is; these types name the
 * three INDEPENDENT axes underneath it so future work (the five-style expansion,
 * the Phase 12 MIDI library format) has something stable to reference:
 *
 *   Style × Rhythm Feel × Instrument Role
 *
 * Pure domain vocabulary — no React Native, no engine imports. Nothing in the
 * render pipeline reads these yet, so adding them cannot change any sound.
 */

/**
 * The long-term accompaniment style axis (design v1.01 §5). Not a strict genre
 * taxonomy — it is the player's answer to 「どのような伴奏にしたいか」.
 */
export type AccompanimentStyle = 'ballad' | 'band' | 'city' | 'dance' | 'rnb';

/**
 * The rhythm-feel axis (design v1.01 §6): how the off-beat 8th sits. Straight
 * keeps the midpoint; swing/shuffle push it late (gently vs. a triplet 2:1).
 */
export type RhythmFeel = 'straight' | 'shuffle' | 'swing';

/**
 * The instrument-role axis: what a part DOES, independent of the sample that
 * plays it. Superset of what the engine renders today (piano-family comp +
 * bass + kit); guitar/strings are named now so the Phase 12 library format can
 * tag patterns for parts the engine doesn't render yet.
 */
export type InstrumentRole = 'drums' | 'bass' | 'piano' | 'guitar' | 'strings';

/** The axis coordinates of one selector rhythm. */
export interface RhythmAxes {
  style: AccompanimentStyle;
  feel: RhythmFeel;
  /** Meter the rhythm plays in (4 for common time, 3 for waltz, 6 for 6/8). */
  beatsPerBar: number;
}
