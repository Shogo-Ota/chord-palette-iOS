/** Teacher-MIDI ingest pipeline — public API (docs/midi_dataset_policy.md). */

export { parseSmf } from './smf';
export type { SmfNote, SmfSong, SmfTempo, SmfTimeSignature } from './smf';
export { registryEntryProblems, selectIngestible } from './registry';
export type {
  MidiRegistry,
  MidiRegistryEntry,
  PatternAnnotation,
  RegistrySelection,
  RightsRecord,
  VerificationStatus,
} from './registry';
export { HOME_REGISTER, relativizeSmf } from './relativize';
export type { IngestReport, IngestResult } from './relativize';
