export {
  clarityPriorityPcs,
  resolveAllowed,
  type AllowedToneSet,
  type ChordHarmonyInput,
  type ClarityPriorityPcs,
} from './harmonyResolver';
export {
  HARD_RANGE,
  PREFERRED_RANGE,
  VOICE_REGISTERS,
  clampToHardLimit,
  foldPcToWindow,
  voicePartFor,
  type VoicePart,
} from './registerPolicy';
export {
  emptyVoicingState,
  optimizeAttack,
  scoreVoicing,
  updateVoicingState,
  type ScoreBreakdown,
  type TemplateNote,
  type VoicingResult,
  type VoicingState,
} from './voicingOptimizer';
