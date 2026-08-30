/**
 * Slash chords, sus and add rules — the cases where the bass note or a replaced degree
 * changes what the symbol means.
 *
 * The slash distinction is the load-bearing one. `C/E` is C major with a chosen bass, so
 * the upper chord is unchanged. `C/D` is its own harmony, and forcing D into the upper
 * chord-tone set would be a different chord than the one written.
 */

import type { BookSourceRef } from './provenance';

export type SlashChordPolicy = {
  id: string;
  bassType: 'chordTone' | 'nonChordTone';
  identityRule: string;
  source: readonly BookSourceRef[];
};

export const SLASH_CHORD_RULES: readonly SlashChordPolicy[] = [
  {
    id: 'chord_tone_bass',
    bassType: 'chordTone',
    identityRule:
      'Chord quality/function is retained; slash notation specifies inversion/bass choice.',
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [113, 114, 115], chapter: 'Part 3 / 分数コード' },
    ],
  },
  {
    id: 'non_chord_tone_bass',
    bassType: 'nonChordTone',
    identityRule:
      'Treat as a distinct slash harmony; do not force the bass pitch into the upper chord-tone set.',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [118, 119, 120, 121, 122],
        chapter: 'Part 3 / 分数コード',
      },
    ],
  },
];

/**
 * sus4 replaces the 3rd rather than joining it. Sounding both is not a richer sus4, it is
 * a different chord.
 */
export const SUS_RULES: {
  replaceThirdWithFourth: true;
  allowThirdSimultaneously: false;
  defaultResolution: '4_to_3';
  source: readonly BookSourceRef[];
} = {
  replaceThirdWithFourth: true,
  allowThirdSimultaneously: false,
  defaultResolution: '4_to_3',
  source: [
    {
      kind: 'BOOK_EXPLICIT',
      printedPages: [104, 105, 106, 107, 108],
      chapter: 'Part 3 / sus4コード',
    },
  ],
};

/** `add9` means a 9th without a 7th — that absence is the definition, not an omission. */
export const ADD_RULES: {
  add9HasNoSeventhByDefinition: true;
  source: readonly BookSourceRef[];
} = {
  add9HasNoSeventhByDefinition: true,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [109, 110, 111, 112], chapter: 'Part 3 / addコード' },
  ],
};
