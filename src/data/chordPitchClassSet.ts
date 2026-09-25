import { intervalsForChord } from '@/lib/theory/definitions';

/** Anything that knows its root and its chord quality. */
export interface PitchClassSetSource {
  rootOffset: number;
  suffix: string;
  definitionId?: string;
}

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The pitch classes a chord sounds, relative to the key tonic, deduplicated and
 * ascending.
 */
export function chordPitchClasses(chord: PitchClassSetSource): number[] {
  const pitchClasses = intervalsForChord(chord.suffix, chord.definitionId).map((interval) =>
    wrap(chord.rootOffset + interval),
  );
  return [...new Set(pitchClasses)].sort((a, b) => a - b);
}

/**
 * A key that two chords share when they sound the same notes, whatever they are
 * called.
 *
 * Symmetric chords need this. An augmented triad divides the octave into three
 * equal parts, so `Caug`, `Eaug` and `A♭aug` are one chord under three names, and
 * comparing root and suffix would call them different. Diminished sevenths do the
 * same thing four ways.
 */
export function pitchClassSetKey(chord: PitchClassSetSource): string {
  return chordPitchClasses(chord).join(',');
}
