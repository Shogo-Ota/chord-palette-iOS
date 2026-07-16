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
/** Upper bass fundamental (C2), an octave below the chord body. */
const BASS_ROOT_MIDI = 36;
/**
 * Sub-octave bass fundamental (C1). Doubled an octave below {@link BASS_ROOT_MIDI}
 * on every chord so there is real low-frequency energy — a bare mid-register triad
 * sounds thin/"cheap" on its own. Requires the sampler's low range to extend to C1.
 */
const SUB_BASS_ROOT_MIDI = 24;

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
  // Major-quality extensions (avoid-note aware): the ♮11 is dropped so 9/13 stay
  // consonant over a major 3rd (used by I / IV — Ionian & Lydian).
  maj9: [0, 4, 7, 11, 14],
  maj13: [0, 4, 7, 11, 14, 21],
  // Minor-quality variations (used by ii / iii / vi) so a diatonic minor degree
  // never flips to a major 3rd when a tension is added.
  'm(add9)': [0, 3, 7, 14],
  'm(add11)': [0, 3, 7, 17], // add-11 without the 9 (keeps iii/Phrygian ♭9-free)
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m13: [0, 3, 7, 10, 14, 21],
};

function intervalsFor(suffix: string): number[] {
  return INTERVALS[suffix] ?? INTERVALS[''];
}

function pitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * Concrete MIDI notes for a chord in the given key. Every chord is anchored by a
 * two-octave bass fundamental (C1 + C2) — the chord root, or the slash bass when
 * present — so the low end carries weight and the timbre reads as a full piano
 * rather than a thin mid-register cluster. The chord body sits in the C3 band.
 * Bass notes come first (lowest → highest).
 */
export function chordMidiNotes(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
): number[] {
  const tonic = keyTonicPc(key);
  const rootMidi = CHORD_ROOT_MIDI + pitchClass(tonic + (chord.rootOffset ?? 0));
  const body = intervalsFor(chord.suffix ?? '').map((iv) => rootMidi + iv);

  // Slash chords put their explicit bass in the low octaves; otherwise the root.
  const bassPc = pitchClass(tonic + (chord.bassOffset ?? chord.rootOffset ?? 0));
  const bass = [SUB_BASS_ROOT_MIDI + bassPc, BASS_ROOT_MIDI + bassPc];

  return [...bass, ...body];
}

/** Map a progression to the ChordSpec list consumed by the scheduler. */
export function progressionToChordSpecs(progression: ChordEvent[], key: MajorKey): ChordSpec[] {
  return progression.map((e) => ({
    midiNotes: chordMidiNotes(e, key),
    lengthBeats: e.durationBeats,
  }));
}
