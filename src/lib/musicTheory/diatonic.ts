/**
 * Diatonic degrees for major and natural minor: which quality sits on each scale step,
 * what it does functionally, and which chord scale it draws tensions from.
 *
 * This is the table that lets a chord be understood in a key rather than in isolation.
 * The same `Dm7` is a subdominant ii in C and a tonic vi in F, and its available
 * tensions differ accordingly.
 */

import type { ChordQuality } from './chordFormulas';
import type { ScaleId } from './scales';
import type { BookSourceRef } from './provenance';

export type HarmonicFunction = 'TONIC' | 'SUBDOMINANT' | 'DOMINANT';

export type DiatonicDegreeRule = {
  degree: string;
  /** Semitones above the key tonic. */
  rootOffset: number;
  triad: ChordQuality;
  seventh: ChordQuality;
  /**
   * Absent where the book does not assign a clear function — the natural minor v and
   * ♭VII are the cases, and inventing one for them would be our claim, not the book's.
   */
  function?: HarmonicFunction;
  chordScale: ScaleId;
};

export const MAJOR_DIATONIC: readonly DiatonicDegreeRule[] = [
  {
    degree: 'I',
    rootOffset: 0,
    triad: 'maj',
    seventh: 'maj7',
    function: 'TONIC',
    chordScale: 'ionian',
  },
  {
    degree: 'ii',
    rootOffset: 2,
    triad: 'min',
    seventh: 'min7',
    function: 'SUBDOMINANT',
    chordScale: 'dorian',
  },
  {
    degree: 'iii',
    rootOffset: 4,
    triad: 'min',
    seventh: 'min7',
    function: 'TONIC',
    chordScale: 'phrygian',
  },
  {
    degree: 'IV',
    rootOffset: 5,
    triad: 'maj',
    seventh: 'maj7',
    function: 'SUBDOMINANT',
    chordScale: 'lydian',
  },
  {
    degree: 'V',
    rootOffset: 7,
    triad: 'maj',
    seventh: '7',
    function: 'DOMINANT',
    chordScale: 'mixolydian',
  },
  {
    degree: 'vi',
    rootOffset: 9,
    triad: 'min',
    seventh: 'min7',
    function: 'TONIC',
    chordScale: 'aeolian',
  },
  {
    degree: 'viiø',
    rootOffset: 11,
    triad: 'dim',
    seventh: 'min7b5',
    function: 'DOMINANT',
    chordScale: 'locrian',
  },
];

export const MAJOR_DIATONIC_SOURCE: readonly BookSourceRef[] = [
  {
    kind: 'BOOK_EXPLICIT',
    printedPages: [22, 23, 24, 25, 26],
    chapter: 'Part 2 / ダイアトニック・コード',
  },
  {
    kind: 'BOOK_EXPLICIT',
    printedPages: [28, 29, 30, 31, 32, 33, 34, 35, 36],
    chapter: 'Part 2 / メジャー・ダイアトニックのコード進行',
  },
  { kind: 'BOOK_EXPLICIT', printedPages: [40, 41], chapter: 'Part 2 / コード・スケール1' },
];

export const NATURAL_MINOR_DIATONIC: readonly DiatonicDegreeRule[] = [
  {
    degree: 'i',
    rootOffset: 0,
    triad: 'min',
    seventh: 'min7',
    function: 'TONIC',
    chordScale: 'aeolian',
  },
  {
    degree: 'iiø',
    rootOffset: 2,
    triad: 'dim',
    seventh: 'min7b5',
    function: 'SUBDOMINANT',
    chordScale: 'locrian',
  },
  {
    degree: 'bIII',
    rootOffset: 3,
    triad: 'maj',
    seventh: 'maj7',
    function: 'TONIC',
    chordScale: 'ionian',
  },
  {
    degree: 'iv',
    rootOffset: 5,
    triad: 'min',
    seventh: 'min7',
    function: 'SUBDOMINANT',
    chordScale: 'dorian',
  },
  { degree: 'v', rootOffset: 7, triad: 'min', seventh: 'min7', chordScale: 'phrygian' },
  {
    degree: 'bVI',
    rootOffset: 8,
    triad: 'maj',
    seventh: 'maj7',
    function: 'SUBDOMINANT',
    chordScale: 'lydian',
  },
  { degree: 'bVII', rootOffset: 10, triad: 'maj', seventh: '7', chordScale: 'mixolydian' },
];

export const NATURAL_MINOR_SOURCE: readonly BookSourceRef[] = [
  {
    kind: 'BOOK_EXPLICIT',
    printedPages: [57, 58, 59, 60, 61, 62, 63],
    chapter: 'Part 2 / ナチュラル・マイナー',
  },
  { kind: 'BOOK_EXPLICIT', printedPages: [73, 74, 75], chapter: 'Part 2 / コード・スケール2' },
];
