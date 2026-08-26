export {
  buildCompactBaseVoicings,
  buildCompactBaseVoicingsWithPreferences,
  compactCandidatesForHarmony,
} from './CompactVoicingEngine';
export { baseVoicingTransitionCost, orderedVoicingPitches } from './continuity';
export { compactRegisterPolicy, isCompactHandModel } from './handModel';
export { COMPACT_V1_POLICY } from './policy/compactV1Policy';
export { COMPACT_V2_POLICY } from './policy/compactV2Policy';
export {
  LOW_CLUSTER_HARD_CEILING,
  V2_COST_WEIGHTS,
  evaluateCompactV2Cost,
  minorSecondPenalty,
} from './policy/compactV2Costs';
export {
  intervalRole,
  isGuideRole,
  isTensionRole,
  type IntervalRole,
} from './policy/intervalRoles';
export { selectVoicingPath } from './policy/pathSearch';
export {
  APPROVED_VOICING_POLICY_ID,
  VOICING_POLICY_IDS,
  activeVoicingPolicy,
  activeVoicingPolicyId,
  normalizeVoicingPolicyId,
  setVoicingPolicyOverride,
  voicingPolicyById,
  voicingPolicyOptions,
} from './policy/registry';
export type {
  VoicingCostContext,
  VoicingPolicyId,
  VoicingPolicySpec,
  VoicingToneSpec,
} from './policy/types';
export {
  DEFAULT_BASE_VOICING_PREFERENCE,
  DEFAULT_VOICING_POSITION,
  normalizeVoicingPosition,
  VOICING_POSITIONS,
  type BaseVoicing,
  type BaseVoicingCandidate,
  type BaseVoicingHand,
  type BaseVoicingNote,
  type BaseVoicingPreference,
  type VoicingPosition,
} from './types';
