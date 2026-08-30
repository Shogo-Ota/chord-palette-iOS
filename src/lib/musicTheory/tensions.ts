/**
 * Which tensions are available on each diatonic degree, and which are avoid notes.
 *
 * The `avoid` lists are the reason this table cannot be replaced by a rule of thumb.
 * An 11th is an avoid note on Imaj7 and available on ii7, even though both are diatonic
 * seventh chords a whole step apart — the difference is that the 11th sits a semitone
 * above Imaj7's 3rd and a whole step above ii7's. Only the context table knows.
 *
 * The dominant 7th is deliberately not in these tables. The book treats its tensions as
 * scale-dependent rather than fixed, so it gets a universe of candidates plus a per-scale
 * option list instead of one answer.
 */

import type { TensionToken } from './degrees';
import type { ScaleId } from './scales';
import type { AppPolicySourceRef, BookSourceRef } from './provenance';

export type TensionRule = {
  /** Degree-in-key identifier, e.g. `Imaj7` or `ii_m7b5_natural_minor`. */
  contextId: string;
  available: readonly TensionToken[];
  avoid: readonly TensionToken[];
  chordScale: ScaleId;
  source: readonly BookSourceRef[];
};

const TENSION_1: BookSourceRef = {
  kind: 'BOOK_DIAGRAM',
  printedPages: [52],
  chapter: 'Part 2 / テンション1',
};

const TENSION_2_EARLY: BookSourceRef = {
  kind: 'BOOK_DIAGRAM',
  printedPages: [85],
  chapter: 'Part 2 / テンション2',
};

const TENSION_2_LATE: BookSourceRef = {
  kind: 'BOOK_DIAGRAM',
  printedPages: [86],
  chapter: 'Part 2 / テンション2',
};

/** Major-key basic tensions, avoid notes already removed from `available`. */
export const MAJOR_DIATONIC_TENSIONS: readonly TensionRule[] = [
  {
    contextId: 'Imaj7',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'ionian',
    source: [TENSION_1],
  },
  {
    contextId: 'ii7',
    available: ['9', '11'],
    avoid: ['13'],
    chordScale: 'dorian',
    source: [TENSION_1],
  },
  {
    contextId: 'iii7',
    available: ['11'],
    avoid: ['b9', 'b13'],
    chordScale: 'phrygian',
    source: [TENSION_1],
  },
  {
    contextId: 'IVmaj7',
    available: ['9', '#11', '13'],
    avoid: [],
    chordScale: 'lydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52, 53], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'V7_major_basic',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'mixolydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52, 54], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'vi7',
    available: ['9', '11'],
    avoid: ['b13'],
    chordScale: 'aeolian',
    source: [TENSION_1],
  },
  {
    contextId: 'vii_m7b5',
    available: ['11', 'b13'],
    avoid: ['b9'],
    chordScale: 'locrian',
    source: [TENSION_1],
  },
];

export const NATURAL_MINOR_TENSIONS: readonly TensionRule[] = [
  {
    contextId: 'i7_natural_minor',
    available: ['9', '11'],
    avoid: ['b13'],
    chordScale: 'aeolian',
    source: [TENSION_2_EARLY],
  },
  {
    contextId: 'ii_m7b5_natural_minor',
    available: ['11', 'b13'],
    avoid: ['b9'],
    chordScale: 'locrian',
    source: [TENSION_2_EARLY],
  },
  {
    contextId: 'bIIImaj7_natural_minor',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'ionian',
    source: [TENSION_2_EARLY],
  },
  {
    contextId: 'iv7_natural_minor',
    available: ['9', '11'],
    avoid: ['13'],
    chordScale: 'dorian',
    source: [TENSION_2_EARLY],
  },
  {
    contextId: 'v7_natural_minor',
    available: ['11'],
    avoid: ['b9', 'b13'],
    chordScale: 'phrygian',
    source: [TENSION_2_LATE],
  },
  {
    contextId: 'bVImaj7_natural_minor',
    available: ['9', '#11', '13'],
    avoid: [],
    chordScale: 'lydian',
    source: [TENSION_2_LATE],
  },
  {
    contextId: 'bVII7_natural_minor',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'mixolydian',
    source: [TENSION_2_LATE],
  },
];

/**
 * The dominant 7th's tension candidates. `basicMajorKey` and `basicMinorKey` are the
 * defaults; the full `potential` set is what an altered or substitute dominant may reach.
 */
export const DOMINANT_TENSION_UNIVERSE: {
  potential: readonly TensionToken[];
  basicMajorKey: readonly TensionToken[];
  basicMinorKey: readonly TensionToken[];
  source: readonly BookSourceRef[];
} = {
  potential: ['b9', '9', '#9', '#11', 'b13', '13'],
  basicMajorKey: ['9', '13'],
  basicMinorKey: ['b9', 'b13'],
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [54, 55, 56], chapter: 'Part 2 / テンション1' },
    {
      kind: 'BOOK_EXPLICIT',
      printedPages: [85, 87, 88, 89, 90, 91],
      chapter: 'Part 2 / テンション2',
    },
  ],
};

/**
 * The general shape of an avoid note, for contexts the explicit tables do not cover.
 *
 * `hardGate: false` is the important field and it is the book's position, not a
 * concession: chord-scale tables and dominant type produce genuine exceptions, so
 * "a semitone above a chord tone is always wrong" would reject music the book endorses.
 * A consumer may price this as a cost. It may not reject on it.
 */
export const AVOID_NOTE_HEURISTIC: {
  statement: string;
  hardGate: false;
  source: readonly BookSourceRef[];
  policyNote: AppPolicySourceRef;
} = {
  statement:
    'A candidate extension a semitone above a chord tone is generally treated as an avoid note; explicit chord-scale tables override this heuristic.',
  hardGate: false,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [47, 48, 49, 50, 51], chapter: 'Part 2 / テンション1' },
  ],
  policyNote: {
    kind: 'APP_POLICY_PROPOSED',
    chapter: 'Chord Palette implementation layer',
    note: 'Consume as a soft cost only. Rejecting on an avoid note would contradict the book.',
  },
};
