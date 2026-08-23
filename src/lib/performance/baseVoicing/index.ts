export {
  buildCompactBaseVoicings,
  buildCompactBaseVoicingsWithPreferences,
  compactCandidatesForHarmony,
} from './CompactVoicingEngine';
export { baseVoicingTransitionCost, selectContinuousCandidatePath } from './continuity';
export { compactRegisterPolicy, isCompactHandModel } from './handModel';
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
