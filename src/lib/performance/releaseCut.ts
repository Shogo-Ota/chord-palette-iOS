/**
 * Piano release-cut post-process (device preference).
 *
 * When `releaseCut` is true (default), NoteEvents keep their Performance Engine
 * gate lengths — notes end tightly at the scheduled boundary.
 * When false, chord / bass / top durations are stretched so the sampled piano
 * rings past the rhythmic grid (drums are never touched).
 */

import type { NoteEvent, TrackId } from './NoteEvent';

/** Tracks that play through the chord instrument (piano / E.Piano). */
const PIANO_TRACKS: ReadonlySet<TrackId> = new Set(['chord', 'bass', 'top']);

/** Stretch factor when release cut is off. */
const RING_FACTOR = 2.0;
/** Cap so a short stab does not become an endless hang. */
const RING_MAX_BEATS = 2.5;

/**
 * Apply (or skip) release-cut shaping. Pure: same inputs ⇒ identical output.
 * Returns the input array unchanged when `releaseCut` is true (identity).
 */
export function applyReleaseCut(events: NoteEvent[], releaseCut: boolean): NoteEvent[] {
  if (releaseCut) return events;
  return events.map((e) => {
    if (!PIANO_TRACKS.has(e.trackId)) return e;
    const extended = Math.min(e.durationBeat * RING_FACTOR, RING_MAX_BEATS);
    if (extended <= e.durationBeat) return e;
    return { ...e, durationBeat: extended };
  });
}
