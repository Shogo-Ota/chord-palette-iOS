import type { ChordDuration } from '@/types';

import type { AppPolicySourceRef } from './provenance';

const INSERTION_POLICY_SOURCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette / L3 Evolution / Harmonic insertion',
  note: 'Preserve total beats by splitting only durations represented by the editor contract.',
};

const RANKING_POLICY_SOURCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette / L3 Evolution / Candidate ranking',
  note: 'Rank deterministic context-aware candidates and diversify the visible top three.',
};

export const L3_INSERTION_POLICY = {
  durationSplits: {
    4: [2, 2],
    2: [1, 1],
  },
  unsupportedDurations: [1],
  requirePreviousChord: true,
  preserveTotalBeats: true,
  source: INSERTION_POLICY_SOURCE,
} as const;

export function splitL3InsertionDuration(
  duration: ChordDuration,
): readonly [ChordDuration, ChordDuration] | null {
  if (duration === 4) return L3_INSERTION_POLICY.durationSplits[4];
  if (duration === 2) return L3_INSERTION_POLICY.durationSplits[2];
  return null;
}

export const L3_RANKING_POLICY = {
  maximumCandidates: 3,
  componentWeights: {
    resolutionStrength: 12,
    voiceLeadingCost: -2,
    bassMovementCost: -3,
    commonToneScore: 3,
    harmonicFunctionFit: 8,
    tensionValidity: 4,
    complexityDelta: -5,
  },
  diversityPenalties: {
    sameTechnique: 24,
    sameHarmonicEffect: 12,
  },
  tieBreak: 'CANDIDATE_ID',
  source: RANKING_POLICY_SOURCE,
} as const;
