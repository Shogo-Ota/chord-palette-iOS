/** Realtime playback plan (v2) — public API of the playback domain module. */

export { base64ToBytes, bytesToBase64 } from './base64';
export { countInForStart, EDITOR_COUNT_IN, type CountInConfig } from './countIn';
export { compareSnapshotToSequencer, type Phase3cFidelityRow } from './compareSnapshotToSequencer';
export {
  PHASE3C_CASES,
  PHASE3C_CASE_IDS,
  type Phase3cCase,
  type Phase3cCaseId,
} from './phase3cCases';
export {
  buildNativePlaybackPlan,
  snapshotSignature,
  snapshotToMidiEvents,
  type NativeMidiEvent,
  type NativePlaybackPlan,
  type NativePlaybackPlanOptions,
} from './nativePlaybackPlan';
