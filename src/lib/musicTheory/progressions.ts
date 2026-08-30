/**
 * Progression-level vocabulary. Recorded so the concepts are addressable; none of it is
 * quantified yet.
 *
 * `generatorScope` is the useful distinction: a `candidate` idiom proposes a fresh chord
 * sequence, a `transform` idiom rewrites one that already exists. A line cliché keeps the
 * harmony and moves one voice, so it can never be a source of new chords.
 */

import type { BookSourceRef } from './provenance';

export type ProgressionVocabulary = {
  id: string;
  purpose: string;
  generatorScope: 'candidate' | 'transform';
  source: readonly BookSourceRef[];
};

export const PROGRESSION_VOCABULARY: readonly ProgressionVocabulary[] = [
  {
    id: 'turnaround',
    purpose:
      'Create a return-to-tonic / loop-oriented closing motion using functional substitutions and dominants.',
    generatorScope: 'candidate',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [210, 211, 212, 213, 214],
        chapter: 'Part 4 / ターンアラウンド',
      },
    ],
  },
  {
    id: 'line_cliche',
    purpose: 'Keep a chordal center while moving one internal/top voice chromatically or stepwise.',
    generatorScope: 'transform',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [215, 216, 217, 218, 219, 220],
        chapter: 'Part 4 / ライン・クリシェ',
      },
    ],
  },
  {
    id: 'blues_function',
    purpose:
      'Treat blues harmony as its own functional vocabulary rather than forcing strict diatonic-major logic.',
    generatorScope: 'candidate',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [
          180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
          198, 199, 200, 201, 202, 203, 204,
        ],
        chapter: 'Part 4 / ブルースの音楽理論的な考察',
      },
    ],
  },
];
