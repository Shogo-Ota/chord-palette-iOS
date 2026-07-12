/**
 * Chord → MIDI voicing (pure, UI-independent). Turns the degree-based chord data
 * carried on every {@link ChordEvent} (`rootOffset` semitones above the tonic +
 * quality `suffix`, plus an optional slash `bassOffset`) into concrete MIDI note
 * numbers for the audio engine. Kept out of the native layer so the engine only
 * ever receives a generic list of notes (sprint-2.md §2).
 */

import { keyTonicPc } from '@/data/music';
import type { ChordSpec } from '@/services/audio/schedule';
import type { ChordEvent, MajorKey } from '@/types';

/** Register for chord roots (C3). Keeps triads/7ths in a comfortable mid band. */
const CHORD_ROOT_MIDI = 48;
/** Register for slash-chord bass notes (C2), an octave below the chord. */
const BASS_ROOT_MIDI = 36;

/**
 * Semitone intervals above the root for each chord quality we produce across the
 * library (diatonic triads/7ths, variations, secondary dominants, modal, slash).
 * Extended chords (9/11/13) are voiced compactly rather than fully stacked.
 */
const INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7], // major triad
  m: [0, 3, 7], // minor triad
  dim: [0, 3, 6], // diminished triad
  aug: [0, 4, 8], // augmented triad
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'm7♭5': [0, 3, 6, 10], // half-diminished
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  '11': [0, 5, 7, 10, 14], // 3rd omitted to avoid clashing with the 11th
  '13': [0, 4, 7, 10, 14, 21],
};

function intervalsFor(suffix: string): number[] {
  return INTERVALS[suffix] ?? INTERVALS[''];
}

function pitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Concrete MIDI notes for a chord in the given key (bass first when a slash chord). */
export function chordMidiNotes(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
): number[] {
  const tonic = keyTonicPc(key);
  const rootMidi = CHORD_ROOT_MIDI + pitchClass(tonic + (chord.rootOffset ?? 0));
  const notes = intervalsFor(chord.suffix ?? '').map((iv) => rootMidi + iv);
  if (chord.bassOffset != null) {
    notes.unshift(BASS_ROOT_MIDI + pitchClass(tonic + chord.bassOffset));
  }
  return notes;
}

/** Map a progression to the ChordSpec list consumed by the scheduler. */
export function progressionToChordSpecs(progression: ChordEvent[], key: MajorKey): ChordSpec[] {
  return progression.map((e) => ({
    midiNotes: chordMidiNotes(e, key),
    lengthBeats: e.durationBeats,
  }));
}
