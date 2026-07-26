/**
 * Remeter — scale a progression from the authoring meter into a rhythm's meter.
 *
 * Chords are stored in a fixed 4/4 quarter-note space (`AUTHORING_BEATS_PER_BAR`).
 * A waltz bar is 3 beats and a 6/8 bar is 6 eighth-pulses; without scaling, a
 * stored "1 bar" chord would spill across waltz bars and the oom-pah would start
 * mid-harmony. Remetering keeps "one stored bar = one musical bar" by multiplying
 * every onset and length by `to / from`. Pure, total, and reversible.
 */

import type { PerfChord } from '../PerformanceEngine';

/** The meter every saved `durationBeats` is written in. Never change this. */
export const AUTHORING_BEATS_PER_BAR = 4;

/** Scale factor that turns authoring beats into a rhythm's beats (1 when 4/4). */
export function remeterScale(toBeatsPerBar: number): number {
  if (!Number.isFinite(toBeatsPerBar) || toBeatsPerBar <= 0) return 1;
  return toBeatsPerBar / AUTHORING_BEATS_PER_BAR;
}

/** Map authoring-space beats onto a rhythm's beat space. */
export function remeterBeats(beats: number, toBeatsPerBar: number): number {
  return beats * remeterScale(toBeatsPerBar);
}

/** Map a rhythm's beat position back to authoring space (playhead → card index). */
export function authoringBeats(beats: number, fromBeatsPerBar: number): number {
  const scale = remeterScale(fromBeatsPerBar);
  return scale === 0 ? beats : beats / scale;
}

/** Remeter a voice-led chord list. No-op when the meters already agree. */
export function remeterChords(chords: PerfChord[], toBeatsPerBar: number): PerfChord[] {
  const scale = remeterScale(toBeatsPerBar);
  if (scale === 1) return chords;
  return chords.map((c) => ({
    ...c,
    startBeat: c.startBeat * scale,
    durationBeats: c.durationBeats * scale,
  }));
}
