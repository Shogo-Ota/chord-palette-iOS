import type { GrooveProgression } from './types';

/**
 * Fixed pitch material from Voicing Preference Round1's connectedStable family.
 * Groove candidates may rest/re-attack these pitches but may never invent another pitch.
 */
export const GROOVE_PROGRESSIONS: readonly GrooveProgression[] = [
  {
    id: 'A',
    display: 'C | Am | F | G',
    chordSymbols: ['C', 'Am', 'F', 'G'],
    fixedVoicings: [
      [48, 52, 55, 60],
      [48, 52, 57, 60],
      [48, 53, 57, 60],
      [47, 50, 55, 59],
    ],
  },
  {
    id: 'B',
    display: 'Cmaj7 | Am7 | Fmaj7 | G7',
    chordSymbols: ['Cmaj7', 'Am7', 'Fmaj7', 'G7'],
    fixedVoicings: [
      [48, 52, 55, 59],
      [48, 52, 55, 57],
      [48, 53, 57, 64],
      [47, 50, 55, 65],
    ],
  },
  {
    id: 'C',
    display: 'C | G/B | Am | F',
    chordSymbols: ['C', 'G/B', 'Am', 'F'],
    fixedVoicings: [
      [48, 52, 55, 60],
      [47, 50, 55, 59],
      [45, 48, 52, 57],
      [45, 48, 53, 57],
    ],
  },
];
