/**
 * The degree vocabulary every other table in this database is written in.
 *
 * Degrees are root-relative and spelled, not reduced to numbers: `b3` and `#2` are the
 * same pitch class and different musical facts, and a chord formula has to be able to
 * say which one it means. The semitone map is therefore many-to-one on purpose.
 *
 * Tensions are a separate token type even though every tension is also expressible as
 * a degree. A `9` and a `2` are the same pitch class; only one of them claims to sit
 * above the seventh. Keeping the types distinct stops a tension table from silently
 * being read as a chord formula.
 */

export type DegreeToken =
  | 'R'
  | 'b2'
  | '2'
  | '#2'
  | 'b3'
  | '3'
  | 'b4'
  | '4'
  | '#4'
  | 'b5'
  | '5'
  | '#5'
  | 'b6'
  | '6'
  | '#6'
  | 'bb7'
  | 'b7'
  | '7';

export const DEGREE_TO_SEMITONE: Record<DegreeToken, number> = {
  R: 0,
  b2: 1,
  2: 2,
  '#2': 3,
  b3: 3,
  3: 4,
  b4: 4,
  4: 5,
  '#4': 6,
  b5: 6,
  5: 7,
  '#5': 8,
  b6: 8,
  6: 9,
  '#6': 10,
  bb7: 9,
  b7: 10,
  7: 11,
};

export type TensionToken = 'b9' | '9' | '#9' | '11' | '#11' | 'b13' | '13';

/**
 * The degree each tension is enharmonically equal to. `TENSION_TO_SEMITONE` is derived
 * from this rather than written out again, so the two vocabularies cannot drift apart.
 */
export const TENSION_AS_DEGREE: Record<TensionToken, DegreeToken> = {
  b9: 'b2',
  9: '2',
  '#9': '#2',
  11: '4',
  '#11': '#4',
  b13: 'b6',
  13: '6',
};

export const TENSION_TO_SEMITONE: Record<TensionToken, number> = Object.fromEntries(
  (Object.keys(TENSION_AS_DEGREE) as TensionToken[]).map((tension) => [
    tension,
    DEGREE_TO_SEMITONE[TENSION_AS_DEGREE[tension]],
  ]),
) as Record<TensionToken, number>;

export const DEGREE_TOKENS = Object.keys(DEGREE_TO_SEMITONE) as readonly DegreeToken[];
export const TENSION_TOKENS = Object.keys(TENSION_AS_DEGREE) as readonly TensionToken[];

/** Pitch classes a set of degrees occupies, deduplicated and ascending. */
export function degreePitchClasses(degrees: readonly DegreeToken[]): number[] {
  return [...new Set(degrees.map((degree) => DEGREE_TO_SEMITONE[degree]))].sort((a, b) => a - b);
}
