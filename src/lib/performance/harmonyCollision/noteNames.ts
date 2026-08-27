/**
 * Note spelling for the debug log only. Never used by a rule — a verdict is
 * decided on MIDI numbers, and a name is just how a human reads the record.
 */

const PITCH_CLASS_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

function wrap(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12;
}

export function pitchClassName(pitchClass: number): string {
  return PITCH_CLASS_NAMES[wrap(pitchClass)]!;
}

/** MIDI 60 → `C4`, matching the register numbers the contract's examples use. */
export function midiNoteName(midiNote: number): string {
  return `${pitchClassName(midiNote)}${Math.floor(midiNote / 12) - 1}`;
}
