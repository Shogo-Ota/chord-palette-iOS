export {
  compatibilityMaskForSelection,
  selectNaturalAttackNotes,
  type NaturalAttackVoicingSelection,
  type NaturalVoiceRole,
} from './attackVoicingPolicy';
export {
  velocityForNaturalAttackNote,
  type NaturalAttackVelocityShape,
} from './attackVelocityPolicy';
export {
  CANDIDATE_GROOVE_PROFILES,
  type CandidateGrooveAttackSpec,
  type CandidateGrooveProfile,
  type CandidateNaturalVariantId,
  type CandidatePedalSpec,
} from './candidateGrooveProfiles';
export { DANCE_GROOVE_PROFILE, DANCE_VARIANT_ID } from './danceGrooveProfile';
export { buildStableFullVoicings } from './fullVoicing';
export {
  GROOVE_PROFILE_REGISTRY,
  grooveProfileForVariant,
  type ProfileGrooveVariantId,
  type RegisteredGrooveProfile,
} from './grooveProfileRegistry';
export { validateAtomicNatural } from './hardGate';
export { analyzeNaturalAtomicMetrics, type NaturalAtomicMetrics } from './metrics';
export { applyVoicingMask, maskContainsColor, type1MaskSequence } from './masks';
export { naturalPedalEvents } from './pedalPolicy';
export { realizeAtomicNatural, realizeAtomicNaturalType1 } from './realize';
export { extractAtomicNaturalTimeline, extractAtomicType1Timeline } from './timeline';
export {
  naturalRhythmForChord,
  naturalRhythmStrategyFor,
  type NaturalPedalPolicy,
  type NaturalRhythmAttackSpec,
  type NaturalRhythmStrategy,
  type NaturalRhythmVariantId,
} from './rhythmProfiles';
export {
  NATURAL_VOICING_MASKS,
  type AtomicGrooveAttack,
  type AtomicHardGateFailure,
  type AtomicHardGateReport,
  type AtomicNaturalPlan,
  type FullVoicing,
  type FullVoicingNote,
  type NaturalVoicingMask,
  type PianoHandRole,
} from './types';
