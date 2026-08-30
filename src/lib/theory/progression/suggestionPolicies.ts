import type { KeyMode } from '@/types';

/**
 * App-level ranking policy for the deterministic "続き候補" feature.
 *
 * The chord inventory comes from the theory layer (`diatonicTriads`). Template
 * popularity and ranking weights are product policy, not claims copied from the book,
 * so they live here rather than in `musicTheory`.
 */
export interface ProgressionTemplate {
  /** Zero-based scale-degree indices in the policy's own mode. */
  seq: readonly number[];
  /** Small deterministic tie-break nudge. */
  popularity: number;
}

export interface ModeSuggestionPolicy {
  mode: KeyMode;
  startDegrees: readonly { degree: number; score: number }[];
  templates: readonly ProgressionTemplate[];
  advancedColors: 'major' | 'minorPrimaryDominant';
}

const MAJOR_POLICY: ModeSuggestionPolicy = {
  mode: 'major',
  startDegrees: [
    { degree: 0, score: 1.0 },
    { degree: 5, score: 0.7 },
    { degree: 3, score: 0.66 },
  ],
  templates: [
    { seq: [0, 4, 5, 3], popularity: 0.1 }, // I–V–vi–IV
    { seq: [1, 4, 0], popularity: 0.09 }, // ii–V–I
    { seq: [5, 3, 0, 4], popularity: 0.08 }, // vi–IV–I–V
    { seq: [3, 4, 2, 5], popularity: 0.08 }, // IV–V–iii–vi
    { seq: [0, 5, 3, 4], popularity: 0.06 }, // I–vi–IV–V
    { seq: [0, 3, 4, 0], popularity: 0.05 }, // I–IV–V–I
    { seq: [0, 4, 5, 2, 3, 0, 3, 4], popularity: 0.02 }, // canon
  ],
  advancedColors: 'major',
};

/**
 * Natural-minor continuations. Every index resolves through the book-derived seven
 * natural-minor cards; only the ordering/popularity is Chord Palette policy.
 *
 * Deliberately absent: a major V / V7. It belongs to the separate, explicit
 * harmonic-minor dominant provider, not to the basic natural-minor inventory.
 */
const NATURAL_MINOR_POLICY: ModeSuggestionPolicy = {
  mode: 'minor',
  startDegrees: [
    { degree: 0, score: 1.0 }, // i
    { degree: 5, score: 0.72 }, // ♭VI
    { degree: 2, score: 0.68 }, // ♭III
  ],
  templates: [
    { seq: [0, 6, 5, 6], popularity: 0.1 }, // i–♭VII–♭VI–♭VII
    { seq: [0, 5, 2, 6], popularity: 0.09 }, // i–♭VI–♭III–♭VII
    { seq: [0, 3, 4, 0], popularity: 0.08 }, // i–iv–v–i
    { seq: [5, 6, 0], popularity: 0.07 }, // ♭VI–♭VII–i
    { seq: [1, 4, 0], popularity: 0.05 }, // ii°–v–i
  ],
  advancedColors: 'minorPrimaryDominant',
};

const POLICIES: Record<KeyMode, ModeSuggestionPolicy> = {
  major: MAJOR_POLICY,
  minor: NATURAL_MINOR_POLICY,
};

export function suggestionPolicyFor(mode: KeyMode): ModeSuggestionPolicy {
  return POLICIES[mode];
}
