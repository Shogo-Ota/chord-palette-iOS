/**
 * Functional harmony: which chords substitute for which, and which root motions the book
 * calls strong.
 *
 * Nothing here decides a pitch. It exists so a later layer can answer "what is this chord
 * doing" rather than only "what notes is it made of", which is what tension selection
 * needs in order to be more than a lookup by quality.
 */

import type { HarmonicFunction } from './diatonic';
import type { BookSourceRef } from './provenance';

export type MotionRule = {
  id: string;
  from: string;
  to: string;
  /** Ascending semitones from the first root to the second. */
  rootMotionSemitones: number;
  strength: 'strong' | 'normal';
  source: readonly BookSourceRef[];
};

export const FUNCTIONAL_MOTIONS: readonly MotionRule[] = [
  {
    id: 'dominant_motion',
    from: 'V7',
    to: 'I',
    rootMotionSemitones: 5,
    strength: 'strong',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [28, 29, 30],
        chapter: 'Part 2 / メジャー・ダイアトニックのコード進行',
      },
    ],
  },
  {
    id: 'related_ii_v',
    from: 'IIm7',
    to: 'V7',
    rootMotionSemitones: 5,
    strength: 'strong',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [174, 175, 176, 177, 178, 179],
        chapter: 'Part 4 / リレイテッドIIm7',
      },
    ],
  },
];

export type FunctionSubstitutionGroup = {
  keyMode: 'major';
  function: HarmonicFunction;
  degrees: readonly string[];
  notes?: string;
  source: readonly BookSourceRef[];
};

export const MAJOR_FUNCTION_GROUPS: readonly FunctionSubstitutionGroup[] = [
  {
    keyMode: 'major',
    function: 'TONIC',
    degrees: ['Imaj7', 'iii7', 'vi7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [31, 32, 33, 34, 36],
        chapter: 'Part 2 / 代理コード',
      },
    ],
  },
  {
    keyMode: 'major',
    function: 'SUBDOMINANT',
    degrees: ['ii7', 'IVmaj7'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [31, 34, 35, 36], chapter: 'Part 2 / 代理コード' },
    ],
  },
  {
    keyMode: 'major',
    function: 'DOMINANT',
    degrees: ['V7', 'vii_m7b5'],
    notes:
      'The source notes vii_m7b5 as a dominant substitute but treats it as less common in practical use.',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [33, 34, 36], chapter: 'Part 2 / 代理コード' }],
  },
];

export type BorrowedChordRule = {
  id: string;
  sourceMode: 'naturalMinor' | 'harmonicMinor' | 'melodicMinor';
  degree: string;
  use: string;
  source: readonly BookSourceRef[];
};

/**
 * Representative same-tonic borrowings, not an exhaustive allow-list. The book presents
 * mixture as a technique rather than a closed set, so treating this as complete would
 * overstate it.
 */
export const MAJOR_MINOR_MIXTURE: readonly BorrowedChordRule[] = [
  {
    id: 'ivm7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'iv7',
    use: 'subdominant-minor color in major key',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [169, 170, 171, 172, 173],
        chapter: 'Part 4 / メジャー&マイナー・コードのミックス',
      },
    ],
  },
  {
    id: 'bVImaj7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'bVImaj7',
    use: 'borrowed minor-family color',
    source: [
      {
        kind: 'BOOK_DIAGRAM',
        printedPages: [169, 170, 171, 172, 173],
        chapter: 'Part 4 / メジャー&マイナー・コードのミックス',
      },
    ],
  },
  {
    id: 'bVII7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'bVII7',
    use: 'borrowed minor-family color',
    source: [
      {
        kind: 'BOOK_DIAGRAM',
        printedPages: [169, 170, 171, 172, 173],
        chapter: 'Part 4 / メジャー&マイナー・コードのミックス',
      },
    ],
  },
];
