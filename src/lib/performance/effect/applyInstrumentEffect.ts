/**
 * Apply the piano effect to a rendered performance. Pure: same input ⇒ same output.
 *
 * `sustain` keeps every written length: the ring belongs to CC64, which the teacher
 * take supplies and the sequencer engine plays. Stretching note lengths to imitate a
 * pedal would double the ring where CC64 already exists, and — measured in
 * experiment gate-01 — erase the gate / gap / rest structure the styles are built
 * from (Natural lost every rest; City lost a third of its silence). `releaseCut`
 * closes notes early, which is a real articulation choice rather than a fake pedal.
 * Drums are never touched.
 */

import type { NoteEvent, TrackId } from '../NoteEvent';

import type { InstrumentEffect } from './types';

/** Tracks that play through the chord instrument (piano / E.Piano). */
const PIANO_TRACKS: ReadonlySet<TrackId> = new Set(['chord', 'bass', 'top']);

/** How much of the written length survives a release cut. */
const CUT_FACTOR = 0.55;
/** Floor so a cut note is still a note, not a click. */
const CUT_MIN_BEATS = 0.08;

function shortenRelease(events: NoteEvent[]): NoteEvent[] {
  return events.map((e) => {
    if (!PIANO_TRACKS.has(e.trackId)) return e;
    const shortened = Math.max(e.durationBeat * CUT_FACTOR, CUT_MIN_BEATS);
    if (shortened >= e.durationBeat) return e;
    return { ...e, durationBeat: shortened };
  });
}

export function applyInstrumentEffect(events: NoteEvent[], effect: InstrumentEffect): NoteEvent[] {
  switch (effect) {
    case 'releaseCut':
      return shortenRelease(events);
    case 'sustain':
    case 'off':
    default:
      return events;
  }
}
