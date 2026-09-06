import type { DegreeToken } from './degrees';
import type { AppPolicySourceRef } from './provenance';

const TENSION_POLICY_SOURCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette / L2 Evolution / Available tension',
  note: 'Expose only explicit available-table entries backed by a shipped catalog definition.',
};

const SLASH_POLICY_SOURCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette / L2 Evolution / Safe slash bass',
  note: 'Start with third/fifth chord-tone inversions that strictly improve local bass motion.',
};

const RECIPE_POLICY_SOURCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette / L2 Evolution / Candidate ordering',
  note: 'Interleave deterministic tension and slash lanes without a Cartesian product.',
};

export const SAFE_AVAILABLE_TENSION_EVOLUTION_POLICY = {
  explicitAvoidsAreIneligibleForSafeEvolution: true,
  targetOrder: ['ADDED_TONE_COUNT', 'CATALOG_PRIORITY', 'DEFINITION_ID'] as const,
  source: TENSION_POLICY_SOURCE,
} as const;

export const SAFE_SLASH_EVOLUTION_POLICY: {
  readonly allowedBassDegrees: readonly DegreeToken[];
  readonly requireStrictTotalMovementImprovement: true;
  readonly forbidMaximumLeapRegression: true;
  readonly source: AppPolicySourceRef;
} = {
  allowedBassDegrees: ['3', 'b3', '5', 'b5'],
  requireStrictTotalMovementImprovement: true,
  forbidMaximumLeapRegression: true,
  source: SLASH_POLICY_SOURCE,
};

export const L2_EVOLUTION_RECIPE_POLICY = {
  candidateLaneOrder: ['T0', 'S0', 'T1', 'S1', 'T2', 'S2'] as const,
  maximumCandidates: 3,
  source: RECIPE_POLICY_SOURCE,
} as const;
