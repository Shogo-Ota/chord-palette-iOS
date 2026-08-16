export {
  HUMAN_TEMPLATE_ARPEGGIO_P1_C10,
  HUMAN_TEMPLATE_BALLAD_P1_C7,
  HUMAN_TEMPLATE_NORMAL_P1_A1,
  HUMAN_TEMPLATE_VARIATION_P1_C12,
  PRODUCTION_HUMAN_TEMPLATE_IDS,
  humanTemplateById,
  humanTemplateCategoryLabel,
  humanTemplateIdForPattern,
  type ProductionHumanTemplateId,
} from './catalog';
export { chordHarmonyFromEvent } from './chordHarmony';
export {
  compileProductionNote,
  compileProductionNotes,
  realizeDegreePitch,
  type ChordDegree,
  type VoiceRole,
} from './degreePitch';
export {
  classifyTeacherTone,
  intervalFromRoot,
  teacherVelocity,
  type ToneKind,
} from './losslessTone';
export {
  applyGlobalTranspose,
  progressionTransposeDelta,
  reconstructTeacherPitch,
} from './pureTranspose';
export { realizeHumanTemplate, type HumanTemplatePitchMode } from './realize';
export { realizeUserChordAttack } from './userChordVoicing';
export {
  emptyVoiceLeadingState,
  realizeVoiceStructureAttack,
} from './voiceStructureRealize';
export { validateHumanTemplateOutput } from './validate';
export type { HumanMidiTemplate, HumanTemplateAttack } from './types';
