export {
  validateHarmonyCollisions,
  validateHarmonyCollisionsForInstrument,
  type BoundNote,
} from './HarmonyCollisionValidator';
export { boundPitchedNotes, overlappingPairs, type OverlappingPair } from './activeNoteSet';
export { collisionChordFromIntervals, harmonyCollisionChordFor } from './chordContext';
export { formatHarmonyCollision, formatHarmonyCollisionReport } from './debugLog';
export { mergeDuplicateNotes, type DuplicateMergeResult } from './duplicateNotePolicy';
export { collisionProfileFor, shiftProfile, PIANO_COLLISION_PROFILE } from './instrumentProfiles';
export { evaluateIntervalPair, type IntervalVerdict } from './intervalRules';
export { lowIntervalLimitVerdict } from './lowIntervalLimit';
export { midiNoteName, pitchClassName } from './noteNames';
export type {
  HarmonyCollisionChord,
  HarmonyCollisionMode,
  HarmonyCollisionNote,
  HarmonyCollisionOptions,
  HarmonyCollisionReport,
  HarmonyCollisionResult,
  HarmonyCollisionRuleId,
  HarmonyCollisionViolation,
  InstrumentCollisionProfile,
  LowIntervalLimit,
} from './types';
