/**
 * Duplicate notes — a playback problem, not a harmony problem.
 *
 * Two note-ons for the same MIDI number in the same air are harmonically nothing:
 * the pitch was already there. They matter because the second one retriggers the
 * sampler, so the first voice's envelope is cut and the pair reads as an accidental
 * accent. The fix is to keep one note spanning both, with the louder velocity.
 *
 * This function is the merge the contract asks for. Applying it removes a note and
 * therefore changes the audible output, so the caller decides when to run it.
 */

import type { NoteEvent } from '../NoteEvent';

const EPSILON = 1e-6;

export type DuplicateMergeResult = {
  readonly notes: NoteEvent[];
  readonly merged: number;
};

/** Merge simultaneous same-pitch notes on the same voice into one held note. */
export function mergeDuplicateNotes(notes: readonly NoteEvent[]): DuplicateMergeResult {
  const kept: NoteEvent[] = [];
  let merged = 0;
  for (const note of notes) {
    const twin = kept.find(
      (candidate) =>
        candidate.pitch === note.pitch &&
        candidate.trackId === note.trackId &&
        Math.abs(candidate.timeBeat - note.timeBeat) <= EPSILON,
    );
    if (!twin) {
      kept.push(note);
      continue;
    }
    merged += 1;
    const index = kept.indexOf(twin);
    kept[index] = {
      ...twin,
      durationBeat: Math.max(twin.durationBeat, note.durationBeat),
      velocity: Math.max(twin.velocity, note.velocity),
    };
  }
  return { notes: kept, merged };
}
