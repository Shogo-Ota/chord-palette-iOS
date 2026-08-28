/**
 * The diminished 7th's symmetry: a stack of minor thirds that repeats every three
 * semitones, so four different roots spell the same four pitches.
 *
 * The consequence for a generator is that a dim7 has no single correct root, and its
 * inversions are not distinguishable by pitch content alone.
 */

import type { BookSourceRef } from './provenance';

export type DiminishedRuleSet = {
  intervalStackSemitones: number;
  symmetryCycleSemitones: number;
  /** How many roots produce the identical pitch-class set. */
  equivalentRootCount: number;
  passingDiminishedUse: boolean;
  source: readonly BookSourceRef[];
};

export const DIMINISHED_RULES: DiminishedRuleSet = {
  intervalStackSemitones: 3,
  symmetryCycleSemitones: 3,
  equivalentRootCount: 4,
  passingDiminishedUse: true,
  source: [
    {
      kind: 'BOOK_EXPLICIT',
      printedPages: [145, 146, 147, 148, 149, 150, 151, 152, 153],
      chapter: 'Part 3 / ディミニッシュ・コード',
    },
  ],
};

/** The four roots that spell the same dim7, ascending from the given pitch class. */
export function equivalentDiminishedRoots(rootPc: number): number[] {
  const { symmetryCycleSemitones, equivalentRootCount } = DIMINISHED_RULES;
  return Array.from(
    { length: equivalentRootCount },
    (_unused, step) => (((rootPc + step * symmetryCycleSemitones) % 12) + 12) % 12,
  );
}
