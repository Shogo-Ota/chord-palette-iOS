/**
 * Shared Compact Base Voicing policy contract.
 *
 * A policy owns every musical judgement that can change which pitches the
 * Shared Base holds: which chord tones the right hand may drop, how an explicit
 * inversion anchors that hand, what a candidate costs, and how the
 * progression-wide path is searched. The engine owns enumeration only, so a new
 * musical opinion is a new policy file rather than an edit to the generator.
 *
 * Two policies coexist on purpose. `compact.v1` is the audible output a human
 * approved at 87/100, so it stays the shipped default until a successor passes
 * its own listening pass.
 */

import type { HarmonicDegree } from '../../humanTemplate/degreeRoles';
import type { ChordHarmonyInput } from '../../strictV2';
import type { BaseVoicingCandidate, BaseVoicingNote, BaseVoicingPreference } from '../types';

export type VoicingToneSpec = {
  id: string;
  pc: number;
  interval: number;
  degree: HarmonicDegree;
  sourceOrder: number;
};

export type VoicingPolicyId = 'compact.v1' | 'compact.v2' | 'compact.v3';

export type ToneFamilyRequest = {
  harmony: ChordHarmonyInput;
  specs: readonly VoicingToneSpec[];
  bass: VoicingToneSpec;
};

export type VoicingCostContext = {
  rootPc: number;
  availableIntervals: readonly number[];
  preferredRightAnchorPc?: number;
};

/**
 * `HARD` discards any candidate whose right hand does not start on the anchor.
 * `SOFT` prices the miss, so an inversion can still breathe when the anchor
 * would force a cluster.
 */
export type RightAnchorMode = 'HARD' | 'SOFT';

export type VoicingTransitionCost = (
  previous: readonly BaseVoicingNote[],
  next: readonly BaseVoicingNote[],
) => number;

export type VoicingPathSearchOptions = {
  transitionCost: VoicingTransitionCost;
  continuityWeight: number;
};

export type VoicingPathSearch = (
  layers: readonly (readonly BaseVoicingCandidate[])[],
  options: VoicingPathSearchOptions,
) => BaseVoicingCandidate[];

export type VoicingPolicySpec = {
  readonly id: VoicingPolicyId;
  readonly label: string;
  /** Only a policy a human has approved by ear may ship as the default. */
  readonly listeningApproved: boolean;
  /** Right-hand tone subsets to try, most complete first. */
  toneFamilies(request: ToneFamilyRequest): VoicingToneSpec[][];
  readonly rightAnchorMode: RightAnchorMode;
  /** `Number.POSITIVE_INFINITY` rejects the candidate outright. */
  staticCost(
    notes: readonly BaseVoicingNote[],
    preference: BaseVoicingPreference,
    context: VoicingCostContext,
  ): number;
  readonly continuityWeight: number;
  readonly transitionCost: VoicingTransitionCost;
  readonly searchPath: VoicingPathSearch;
};
