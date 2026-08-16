export type {
  FinalMidiControlChange,
  FinalMidiMarker,
  FinalMidiNote,
  FinalMidiSnapshot,
  FinalMidiValidationResult,
  SessionPerformancePlan,
} from '@/lib/performance/finalMidi/types';
export {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
export { buildFinalMidiSnapshot, playbackAccompanimentNotes } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
export { writeSmf, DEFAULT_PPQ } from './smfWrite';
export {
  midiExportBpmToken,
  midiExportFileName,
  midiExportInstrumentToken,
  midiExportProgressionToken,
  midiExportStyleToken,
  midiExportTypeToken,
} from './fileName';
export { assertExportValid, validateFinalMidiSnapshot, validateSmfBytes } from './validate';
