/**
 * The 16 core chord qualities, each as degrees plus the book's judgement about which
 * of them may be dropped.
 *
 * `essentialDegrees` is the part that carries identity — for seventh chords the 3rd and
 * 7th, which is why the root is absent there: a bass line usually supplies it, and the
 * book treats rootless upper voicings as normal rather than exceptional.
 *
 * These are *core* qualities only. Compound symbols like `maj9` or `13(♭9)` are a core
 * quality plus tensions, and that decomposition lives in the resolver, not here.
 */

import type { DegreeToken } from './degrees';
import type { BookSourceRef } from './provenance';

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | '7'
  | 'min7'
  | 'minMaj7'
  | 'min7b5'
  | 'dim7'
  | 'maj6'
  | 'min6'
  | 'sus4'
  | '7sus4'
  | 'add9'
  | 'minAdd9';

export type ChordFormula = {
  quality: ChordQuality;
  degrees: readonly DegreeToken[];
  /** The degrees that carry identity; dropping one changes what the chord is. */
  essentialDegrees: readonly DegreeToken[];
  /** Degrees a voicing may drop without losing identity. */
  normallyOmittableDegrees: readonly DegreeToken[];
  /**
   * True when the 5th is altered (♭5 / ♯5). An altered 5th is a colour, not a filler,
   * so the usual "the perfect 5th may go" permission must not apply to it.
   */
  alteredFifthMustBeRetained?: boolean;
  source: readonly BookSourceRef[];
};

const DIATONIC_TRIADS: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [23, 26],
  chapter: 'Part 2 / ダイアトニック・コード',
};

const PRACTICAL_VOICING: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [24, 228, 229],
  chapter: 'Part 2 / Part 4 実践的ボイシング',
};

const MINOR_DIATONIC_DIAGRAM: BookSourceRef = {
  kind: 'BOOK_DIAGRAM',
  printedPages: [86, 87],
  chapter: 'Part 2 / マイナー・ダイアトニック',
};

const ADD_CHORDS: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [109, 110, 111, 112],
  chapter: 'Part 3 / addコード',
};

export const CHORD_FORMULAS: Record<ChordQuality, ChordFormula> = {
  maj: {
    quality: 'maj',
    degrees: ['R', '3', '5'],
    essentialDegrees: ['R', '3'],
    normallyOmittableDegrees: ['5'],
    source: [DIATONIC_TRIADS],
  },
  min: {
    quality: 'min',
    degrees: ['R', 'b3', '5'],
    essentialDegrees: ['R', 'b3'],
    normallyOmittableDegrees: ['5'],
    source: [DIATONIC_TRIADS],
  },
  dim: {
    quality: 'dim',
    degrees: ['R', 'b3', 'b5'],
    essentialDegrees: ['R', 'b3', 'b5'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [22, 145],
        chapter: 'Part 2 / Part 3 ディミニッシュ',
      },
    ],
  },
  aug: {
    quality: 'aug',
    degrees: ['R', '3', '#5'],
    essentialDegrees: ['R', '3', '#5'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [MINOR_DIATONIC_DIAGRAM],
  },
  maj7: {
    quality: 'maj7',
    degrees: ['R', '3', '5', '7'],
    essentialDegrees: ['3', '7'],
    normallyOmittableDegrees: ['5'],
    source: [PRACTICAL_VOICING],
  },
  7: {
    quality: '7',
    degrees: ['R', '3', '5', 'b7'],
    essentialDegrees: ['3', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [24, 29, 228, 229],
        chapter: 'Part 2 / Part 4 実践的ボイシング',
      },
    ],
  },
  min7: {
    quality: 'min7',
    degrees: ['R', 'b3', '5', 'b7'],
    essentialDegrees: ['b3', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [PRACTICAL_VOICING],
  },
  minMaj7: {
    quality: 'minMaj7',
    degrees: ['R', 'b3', '5', '7'],
    essentialDegrees: ['b3', '7'],
    normallyOmittableDegrees: ['5'],
    source: [MINOR_DIATONIC_DIAGRAM],
  },
  min7b5: {
    quality: 'min7b5',
    degrees: ['R', 'b3', 'b5', 'b7'],
    essentialDegrees: ['b3', 'b5', 'b7'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [24, 65, 228],
        chapter: 'Part 2 / Part 4 実践的ボイシング',
      },
    ],
  },
  dim7: {
    quality: 'dim7',
    degrees: ['R', 'b3', 'b5', 'bb7'],
    essentialDegrees: ['R', 'b3', 'b5', 'bb7'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [145, 146, 147, 148, 149],
        chapter: 'Part 3 / ディミニッシュ・コード',
      },
    ],
  },
  maj6: {
    quality: 'maj6',
    degrees: ['R', '3', '5', '6'],
    essentialDegrees: ['R', '3', '6'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [94, 95, 96, 97], chapter: 'Part 3 / 6thコード' },
    ],
  },
  min6: {
    quality: 'min6',
    degrees: ['R', 'b3', '5', '6'],
    essentialDegrees: ['R', 'b3', '6'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [101, 102, 103], chapter: 'Part 3 / m6thコード' },
    ],
  },
  sus4: {
    quality: 'sus4',
    degrees: ['R', '4', '5'],
    essentialDegrees: ['R', '4'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [104, 105, 106], chapter: 'Part 3 / sus4コード' },
    ],
  },
  '7sus4': {
    quality: '7sus4',
    degrees: ['R', '4', '5', 'b7'],
    essentialDegrees: ['4', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [107, 108], chapter: 'Part 3 / sus4コード' }],
  },
  add9: {
    quality: 'add9',
    degrees: ['R', '3', '5', '2'],
    essentialDegrees: ['R', '3', '2'],
    normallyOmittableDegrees: ['5'],
    source: [ADD_CHORDS],
  },
  minAdd9: {
    quality: 'minAdd9',
    degrees: ['R', 'b3', '5', '2'],
    essentialDegrees: ['R', 'b3', '2'],
    normallyOmittableDegrees: ['5'],
    source: [ADD_CHORDS],
  },
};

export const CHORD_QUALITIES = Object.keys(CHORD_FORMULAS) as readonly ChordQuality[];
