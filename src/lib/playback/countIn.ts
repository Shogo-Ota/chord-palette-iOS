/**
 * Playback-only pre-roll. It is deliberately separate from Final MIDI so a transport
 * cue can never leak into export, loop content, or accompaniment analysis.
 */
export type CountInConfig = {
  /** Number of quarter-note clicks before beat zero. */
  beats: number;
  /** General MIDI percussion note used for each click. */
  midiNote: number;
  /** Velocity for clicks before the final cue. */
  velocity: number;
  /** Stronger final cue immediately before the music starts. */
  finalVelocity: number;
};

/** Four side-stick clicks at the session BPM. */
export const EDITOR_COUNT_IN: Readonly<CountInConfig> = Object.freeze({
  beats: 4,
  midiNote: 37,
  velocity: 82,
  finalVelocity: 104,
});

/** A seek/live re-apply is already inside the song and must never replay the pre-roll. */
export function countInForStart(startBeat: number = 0): CountInConfig | undefined {
  return startBeat <= 0 ? { ...EDITOR_COUNT_IN } : undefined;
}
