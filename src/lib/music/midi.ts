import {
  getDefinitionById,
  intervalsForSuffix,
} from '@/lib/music/definitions/catalog';
import type { ChordSuffix } from '@/lib/music/types';

/** Register for chord roots (C3). */
export const CHORD_ROOT_MIDI = 48;
/** Upper bass fundamental (C2). */
export const BASS_ROOT_MIDI = 36;
/** Sub-octave bass fundamental (C1). */
export const SUB_BASS_ROOT_MIDI = 24;

function pitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

export type ChordMidiInput = {
  rootOffset: number;
  suffix: ChordSuffix;
  /** Prefer catalog intervals when present (timeline / library wiring). */
  definitionId?: string;
  bassOffset?: number;
};

function bodyIntervals(chord: ChordMidiInput): number[] {
  if (chord.definitionId) {
    const fromId = getDefinitionById(chord.definitionId)?.intervals;
    if (fromId) return fromId;
  }
  return intervalsForSuffix(chord.suffix ?? '');
}

/**
 * Concrete MIDI notes for a chord.
 * Bass: C1+C2 on root (or slash bass). Body: C3-band from catalog intervals.
 */
export function chordMidiNotesFromParts(
  chord: ChordMidiInput,
  tonicPc: number,
): number[] {
  const rootMidi = CHORD_ROOT_MIDI + pitchClass(tonicPc + (chord.rootOffset ?? 0));
  const body = bodyIntervals(chord).map((iv) => rootMidi + iv);
  const bassPc = pitchClass(tonicPc + (chord.bassOffset ?? chord.rootOffset ?? 0));
  const bass = [SUB_BASS_ROOT_MIDI + bassPc, BASS_ROOT_MIDI + bassPc];
  return [...bass, ...body];
}

export function bodyPitchClasses(suffix: ChordSuffix): number[] {
  const intervals = intervalsForSuffix(suffix);
  const set = new Set(intervals.map((n) => pitchClass(n)));
  return [...set].sort((a, b) => a - b);
}
