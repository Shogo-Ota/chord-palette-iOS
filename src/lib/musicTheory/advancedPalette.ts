/**
 * Curated non-diatonic harmony rules for the editor's practical chord palette.
 *
 * The underlying techniques and the app's shortlist are deliberately separate:
 * a book source supports the technique, while APP_POLICY_PROPOSED identifies the
 * small set Chord Palette chooses to show instead of behaving like a dictionary.
 */

import { DIMINISHED_RULES } from './diminished';
import type { AppPolicySourceRef, SourceRef } from './provenance';

export type RelativeDegreeSpelling = {
  /** Zero-based scale degree whose letter name should be preserved. */
  degreeIndex: number;
  /** Semitone alteration applied to that degree. */
  alteration: -1 | 0 | 1;
};

export type PassingDiminishedPaletteRule = {
  id: string;
  rootOffset: number;
  rootSpelling: RelativeDegreeSpelling;
  degreeLabel: string;
  targetDegreeIndex: number;
  source: readonly SourceRef[];
};

export type ChromaticMediantPaletteRule = {
  id: string;
  rootOffset: number;
  rootSpelling: RelativeDegreeSpelling;
  degreeLabel: string;
  source: readonly SourceRef[];
};

const CURATED_PALETTE_POLICY: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette advanced chord palette',
  note: 'A small, pop-oriented shortlist selected for practical progression building.',
};

const BACKDOOR_POLICY: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette advanced chord palette / Backdoor dominant',
  note: 'Expose bVII7 resolving to the major tonic under its common practical name.',
};

const CHROMATIC_MEDIANT_POLICY: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette advanced chord palette / Chromatic mediant',
  note: 'Expose four major-seventh colours at major- and minor-third root relations.',
};

/**
 * Major-key passing diminished shortlist. The book explicitly supports passing
 * diminished use; the exact four cards and their display order are app policy.
 */
export const MAJOR_PASSING_DIMINISHED_PALETTE: readonly PassingDiminishedPaletteRule[] = [
  {
    id: 'sharp-one-to-two',
    rootOffset: 1,
    rootSpelling: { degreeIndex: 0, alteration: 1 },
    degreeLabel: '#I°7',
    targetDegreeIndex: 1,
    source: [...DIMINISHED_RULES.source, CURATED_PALETTE_POLICY],
  },
  {
    id: 'flat-three-to-two',
    rootOffset: 3,
    rootSpelling: { degreeIndex: 2, alteration: -1 },
    degreeLabel: '♭III°7',
    targetDegreeIndex: 1,
    source: [...DIMINISHED_RULES.source, CURATED_PALETTE_POLICY],
  },
  {
    id: 'sharp-four-to-five',
    rootOffset: 6,
    rootSpelling: { degreeIndex: 3, alteration: 1 },
    degreeLabel: '#IV°7',
    targetDegreeIndex: 4,
    source: [...DIMINISHED_RULES.source, CURATED_PALETTE_POLICY],
  },
  {
    id: 'sharp-five-to-six',
    rootOffset: 8,
    rootSpelling: { degreeIndex: 4, alteration: 1 },
    degreeLabel: '#V°7',
    targetDegreeIndex: 5,
    source: [...DIMINISHED_RULES.source, CURATED_PALETTE_POLICY],
  },
];

export const MAJOR_BACKDOOR_DOMINANT_PALETTE = {
  id: 'backdoor-to-tonic',
  rootOffset: 10,
  rootSpelling: { degreeIndex: 6, alteration: -1 } satisfies RelativeDegreeSpelling,
  degreeLabel: '♭VII7',
  targetDegreeIndex: 0,
  source: [BACKDOOR_POLICY] as readonly SourceRef[],
} as const;

/** Major-key colour chords. Their non-functional shortlist is app policy. */
export const MAJOR_CHROMATIC_MEDIANT_PALETTE: readonly ChromaticMediantPaletteRule[] = [
  {
    id: 'flat-three-major-seven',
    rootOffset: 3,
    rootSpelling: { degreeIndex: 2, alteration: -1 },
    degreeLabel: '♭IIImaj7',
    source: [CHROMATIC_MEDIANT_POLICY],
  },
  {
    id: 'three-major-seven',
    rootOffset: 4,
    rootSpelling: { degreeIndex: 2, alteration: 0 },
    degreeLabel: 'IIImaj7',
    source: [CHROMATIC_MEDIANT_POLICY],
  },
  {
    id: 'flat-six-major-seven',
    rootOffset: 8,
    rootSpelling: { degreeIndex: 5, alteration: -1 },
    degreeLabel: '♭VImaj7',
    source: [CHROMATIC_MEDIANT_POLICY],
  },
  {
    id: 'six-major-seven',
    rootOffset: 9,
    rootSpelling: { degreeIndex: 5, alteration: 0 },
    degreeLabel: 'VImaj7',
    source: [CHROMATIC_MEDIANT_POLICY],
  },
];
