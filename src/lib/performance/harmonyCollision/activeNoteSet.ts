/**
 * Active note set — which notes are actually sounding together.
 *
 * Shared onsets are not what makes notes collide. A held bass under a syncopated
 * upper voice, a pedalled chord ringing under the next attack and an arpeggio whose
 * gate exceeds its step all put notes in the same air without sharing a start time.
 * The overlap test is therefore `a.start < b.end && b.start < a.end`.
 *
 * Drum voices carry percussion note numbers rather than pitches and are excluded,
 * matching the harmony gate.
 */

import { chordIndexForNote, GATED_TRACKS } from '../harmonyGate';
import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { HarmonyCollisionNote } from './types';

/** Beats closer than this are the same instant as far as a gate is concerned. */
const EPSILON = 1e-6;

export type BoundNote = HarmonyCollisionNote & { readonly chordIndex: number };

export type OverlappingPair = {
  readonly lower: BoundNote;
  readonly upper: BoundNote;
  /** The chord the pair is judged against — the lower note's chord. */
  readonly chordIndex: number;
};

function wrap(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12;
}

/** Pitched notes, each bound to the chord it sounds over, sorted by onset. */
export function boundPitchedNotes(
  notes: readonly NoteEvent[],
  chords: readonly PerfChord[],
): BoundNote[] {
  const bound: BoundNote[] = [];
  for (const note of notes) {
    if (!GATED_TRACKS.has(note.trackId)) continue;
    bound.push({
      midiNote: note.pitch,
      pitchClass: wrap(note.pitch),
      startBeat: note.timeBeat,
      endBeat: note.timeBeat + note.durationBeat,
      trackId: note.trackId,
      chordIndex: chordIndexForNote(chords, note),
    });
  }
  return bound.sort((a, b) => a.startBeat - b.startBeat || a.midiNote - b.midiNote);
}

/**
 * Every pair of pitched notes whose sounding spans overlap, lower note first.
 *
 * Notes are swept in onset order and a note is dropped from the active set once it
 * has released, so the cost tracks the number of simultaneities rather than the
 * square of the note count.
 */
export function overlappingPairs(notes: readonly BoundNote[]): OverlappingPair[] {
  const pairs: OverlappingPair[] = [];
  const active: BoundNote[] = [];
  for (const note of notes) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const held = active[i]!;
      if (held.endBeat <= note.startBeat + EPSILON) {
        active.splice(i, 1);
        continue;
      }
      const lower = held.midiNote <= note.midiNote ? held : note;
      const upper = lower === held ? note : held;
      pairs.push({ lower, upper, chordIndex: lower.chordIndex });
    }
    active.push(note);
  }
  return pairs;
}
