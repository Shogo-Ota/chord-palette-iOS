/**
 * Duplicate notes — a playback problem, not a harmony problem.
 *
 * Two note-ons for the same MIDI number at the same instant are harmonically
 * nothing: the pitch was already there. They matter because the second retriggers
 * the sampler, so the first voice's envelope is cut and the pair reads as an
 * accidental accent. The fix is to keep one note spanning both, with the louder
 * velocity.
 *
 * The repair the contract specifies, kept available and tested but not wired into
 * generation: measured across Golden A–I × every offered variant, the accompaniment
 * produces no simultaneous duplicate at all. Every same-pitch overlap it does produce
 * is a re-articulation at a later beat, which the rhythm asked for and which merging
 * would silently delete. The validator therefore asserts zero duplicates rather than
 * repairing them — if one ever appears, the gate should fail loudly instead of
 * quietly removing a note.
 */

import type { NoteEvent } from '../NoteEvent';

/** Beat resolution for deciding two attacks are the same instant. */
const TICKS_PER_BEAT = 1e6;

export type DuplicateMergeResult = {
  readonly notes: NoteEvent[];
  readonly merged: number;
};

/**
 * Merge simultaneous same-pitch notes into one held note.
 *
 * Voices are deliberately ignored. The accompaniment shares one MIDI channel, so a
 * bass note and a chord note on the same pitch retrigger the same sampler voice just
 * as two chord notes would; the top voice re-articulating a tone the body already
 * holds is the same story. This is also the scope the validator counts duplicates in,
 * and detection and repair have to agree or the report would never reach zero.
 *
 * The first note wins its voice and the merged note keeps the longer span and the
 * louder velocity, so nothing gets quieter or shorter than it was.
 */
export function mergeDuplicateNotes(notes: readonly NoteEvent[]): DuplicateMergeResult {
  const kept: NoteEvent[] = [];
  const indexByKey = new Map<string, number>();
  let merged = 0;
  for (const note of notes) {
    const key = `${note.pitch}@${Math.round(note.timeBeat * TICKS_PER_BEAT)}`;
    const existing = indexByKey.get(key);
    if (existing == null) {
      indexByKey.set(key, kept.length);
      kept.push(note);
      continue;
    }
    merged += 1;
    const twin = kept[existing]!;
    kept[existing] = {
      ...twin,
      durationBeat: Math.max(twin.durationBeat, note.durationBeat),
      velocity: Math.max(twin.velocity, note.velocity),
    };
  }
  return { notes: kept, merged };
}
