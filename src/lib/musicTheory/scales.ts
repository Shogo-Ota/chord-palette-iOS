/**
 * Chord scales as root-relative degree sets.
 *
 * A chord scale is the pool a chord's tensions are drawn from, which is why these matter
 * to voicing at all: "is this 9th available" is answered by the scale, not by the chord
 * symbol. Every scale here is spelled from the chord root, not from the key tonic.
 */

import type { DegreeToken } from './degrees';
import type { BookSourceRef } from './provenance';

export type ScaleId =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'lydianDominant'
  | 'altered'
  | 'wholeTone';

export type ScaleFormula = {
  id: ScaleId;
  degrees: readonly DegreeToken[];
  source: readonly BookSourceRef[];
};

const CHORD_SCALE_1: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [40, 41],
  chapter: 'Part 2 / コード・スケール1',
};

const MODES: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [41],
  chapter: 'Part 2 / コード・スケール1',
};

export const SCALE_FORMULAS: Record<ScaleId, ScaleFormula> = {
  ionian: {
    id: 'ionian',
    degrees: ['R', '2', '3', '4', '5', '6', '7'],
    source: [CHORD_SCALE_1],
  },
  dorian: {
    id: 'dorian',
    degrees: ['R', '2', 'b3', '4', '5', '6', 'b7'],
    source: [CHORD_SCALE_1],
  },
  phrygian: {
    id: 'phrygian',
    degrees: ['R', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    source: [MODES],
  },
  lydian: {
    id: 'lydian',
    degrees: ['R', '2', '3', '#4', '5', '6', '7'],
    source: [MODES],
  },
  mixolydian: {
    id: 'mixolydian',
    degrees: ['R', '2', '3', '4', '5', '6', 'b7'],
    source: [MODES],
  },
  aeolian: {
    id: 'aeolian',
    degrees: ['R', '2', 'b3', '4', '5', 'b6', 'b7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [41, 57, 58],
        chapter: 'Part 2 / コード・スケール1 / マイナー',
      },
    ],
  },
  locrian: {
    id: 'locrian',
    degrees: ['R', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    source: [MODES],
  },
  harmonicMinor: {
    id: 'harmonicMinor',
    degrees: ['R', '2', 'b3', '4', '5', 'b6', '7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [64, 65, 73, 76],
        chapter: 'Part 2 / ハーモニック・マイナー',
      },
    ],
  },
  melodicMinor: {
    id: 'melodicMinor',
    degrees: ['R', '2', 'b3', '4', '5', '6', '7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [69, 70, 80],
        chapter: 'Part 2 / メロディック・マイナー',
      },
    ],
  },
  lydianDominant: {
    id: 'lydianDominant',
    degrees: ['R', '2', '3', '#4', '5', '6', 'b7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [81, 124, 127, 136, 137, 138],
        chapter: 'Part 2 / Part 3 代理ドミナント',
      },
    ],
  },
  altered: {
    id: 'altered',
    degrees: ['R', 'b2', '#2', '3', 'b5', 'b6', 'b7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [81, 82, 90],
        chapter: 'Part 2 / オルタード・スケール',
      },
    ],
  },
  wholeTone: {
    id: 'wholeTone',
    degrees: ['R', '2', '3', 'b5', 'b6', 'b7'],
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [90],
        chapter: 'Part 2 / V7で使える変化系スケール',
      },
    ],
  },
};

export const SCALE_IDS = Object.keys(SCALE_FORMULAS) as readonly ScaleId[];

export function isScaleId(value: string): value is ScaleId {
  return value in SCALE_FORMULAS;
}
