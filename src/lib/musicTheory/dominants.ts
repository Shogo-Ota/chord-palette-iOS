/**
 * Dominant harmony: which scale a V7 draws from, secondary dominants, the tritone
 * substitute, and the related IIm7.
 *
 * ## One deliberate change from the source data file
 *
 * The source listed the minor-key dominant scale as a single id, `harmonicMinorP5Below`.
 * That packs two facts into one string — *which* scale, and *where it is rooted* — and an
 * opaque compound id cannot be turned into pitch classes. It is split here into
 * `scaleId: 'harmonicMinor'` plus `rootedOn: 'perfectFifthBelow'`, which says the same
 * thing and is computable: for `G7` in C minor the scale is C harmonic minor, and C is a
 * perfect fifth below G.
 *
 * This is a structural fix, not a reinterpretation. Every scale id here now resolves in
 * `SCALE_FORMULAS`, which `theoryDbSelfConsistency` asserts.
 */

import type { TensionToken } from './degrees';
import type { ScaleId } from './scales';
import type { BookSourceRef } from './provenance';

/** Where a chord scale is rooted, relative to the chord's own root. */
export type ScaleRooting = 'chordRoot' | 'perfectFifthBelow';

export type DominantScaleOption = {
  scaleId: ScaleId;
  rootedOn: ScaleRooting;
  tensions: readonly TensionToken[];
  typicalContext: string;
  source: readonly BookSourceRef[];
};

export const DOMINANT_SCALE_OPTIONS: readonly DominantScaleOption[] = [
  {
    scaleId: 'mixolydian',
    rootedOn: 'chordRoot',
    tensions: ['9', '13'],
    typicalContext: 'major-key primary V7 basic',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [52, 54], chapter: 'Part 2 / テンション1' }],
  },
  {
    scaleId: 'harmonicMinor',
    rootedOn: 'perfectFifthBelow',
    tensions: ['b9', 'b13'],
    typicalContext: 'minor-key V7 basic',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [87, 88], chapter: 'Part 2 / テンション2' }],
  },
  {
    scaleId: 'altered',
    rootedOn: 'chordRoot',
    tensions: ['b9', '#9', 'b13'],
    typicalContext: 'altered dominant; #11/b5 color is also available in the scale',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [81, 82, 90],
        chapter: 'Part 2 / オルタード・スケール',
      },
    ],
  },
  {
    scaleId: 'lydianDominant',
    rootedOn: 'chordRoot',
    tensions: ['9', '#11', '13'],
    typicalContext: 'substitute dominant / dominant using Lydian b7',
    source: [
      {
        kind: 'BOOK_EXPLICIT',
        printedPages: [124, 127, 136, 137, 138],
        chapter: 'Part 3 / 代理ドミナント',
      },
    ],
  },
];

/** Pitch class the scale of a dominant option is rooted on. */
export function dominantScaleRootPc(chordRootPc: number, rooting: ScaleRooting): number {
  const offset = rooting === 'perfectFifthBelow' ? 5 : 0;
  return (((chordRootPc + offset) % 12) + 12) % 12;
}

export type SecondaryDominantRule = {
  targetDegree: string;
  /** Semitones above the key tonic. */
  dominantRootOffsetFromKey: number;
  dominantQuality: '7';
  targetRootOffsetFromKey: number;
  source: readonly BookSourceRef[];
};

const SECONDARY_DOMINANT_SOURCE: BookSourceRef = {
  kind: 'BOOK_EXPLICIT',
  printedPages: [123, 124, 125, 126, 127, 128, 129, 130, 131],
  chapter: 'Part 3 / セカンダリー・ドミナント',
};

/**
 * Major key. The primary V7 is excluded because it is already diatonic. Every entry
 * resolves down a perfect fifth, which `theoryDbSelfConsistency` checks arithmetically.
 */
export const SECONDARY_DOMINANTS_MAJOR: readonly SecondaryDominantRule[] = [
  {
    targetDegree: 'ii',
    dominantRootOffsetFromKey: 9,
    dominantQuality: '7',
    targetRootOffsetFromKey: 2,
    source: [SECONDARY_DOMINANT_SOURCE],
  },
  {
    targetDegree: 'iii',
    dominantRootOffsetFromKey: 11,
    dominantQuality: '7',
    targetRootOffsetFromKey: 4,
    source: [SECONDARY_DOMINANT_SOURCE],
  },
  {
    targetDegree: 'IV',
    dominantRootOffsetFromKey: 0,
    dominantQuality: '7',
    targetRootOffsetFromKey: 5,
    source: [SECONDARY_DOMINANT_SOURCE],
  },
  {
    targetDegree: 'V',
    dominantRootOffsetFromKey: 2,
    dominantQuality: '7',
    targetRootOffsetFromKey: 7,
    source: [SECONDARY_DOMINANT_SOURCE],
  },
  {
    targetDegree: 'vi',
    dominantRootOffsetFromKey: 4,
    dominantQuality: '7',
    targetRootOffsetFromKey: 9,
    source: [SECONDARY_DOMINANT_SOURCE],
  },
];

/**
 * The tritone substitute. Its 3rd and 7th are the same two pitches as the original
 * dominant's, with their roles exchanged, which is why the substitution keeps the pull
 * while changing the bass.
 */
export const SUBSTITUTE_DOMINANT: {
  rootTransformSemitones: 6;
  sharedGuideToneBehavior: '3rd_and_7th_swap_roles';
  preferredScale: ScaleId;
  source: readonly BookSourceRef[];
} = {
  rootTransformSemitones: 6,
  sharedGuideToneBehavior: '3rd_and_7th_swap_roles',
  preferredScale: 'lydianDominant',
  source: [
    {
      kind: 'BOOK_EXPLICIT',
      printedPages: [132, 133, 134, 135, 136, 137, 138],
      chapter: 'Part 3 / 代理ドミナント',
    },
  ],
};

export function getSubstituteDominantRoot(dominantRootPc: number): number {
  return (((dominantRootPc + SUBSTITUTE_DOMINANT.rootTransformSemitones) % 12) + 12) % 12;
}

export type RelatedIiRule = {
  iiRootOffsetFromDominant: number;
  iiQuality: 'min7';
  appliesTo: readonly ('primary' | 'secondary' | 'substitute' | 'secondarySubstitute')[];
  source: readonly BookSourceRef[];
};

/**
 * Any dominant can be preceded by its own IIm7, a perfect fifth above its root — G7 takes
 * Dm7. The book applies this to substitute and secondary dominants too, not only the
 * primary V7.
 */
export const RELATED_II_RULE: RelatedIiRule = {
  iiRootOffsetFromDominant: 7,
  iiQuality: 'min7',
  appliesTo: ['primary', 'secondary', 'substitute', 'secondarySubstitute'],
  source: [
    {
      kind: 'BOOK_EXPLICIT',
      printedPages: [174, 175, 176, 177, 178, 179],
      chapter: 'Part 4 / リレイテッドIIm7',
    },
  ],
};

export function relatedIiRoot(dominantRootPc: number): number {
  return (((dominantRootPc + RELATED_II_RULE.iiRootOffsetFromDominant) % 12) + 12) % 12;
}
