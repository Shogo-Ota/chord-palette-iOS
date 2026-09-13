import type { DrumBeat } from '@/lib/drum/drumBeat';
import type { DrumMode } from '@/lib/drum/drumMode';
import type { InstrumentEffect } from '@/lib/performance/effect';
import type { AccompanimentEnergy } from '@/lib/performance/energy';
import type { AccompanimentVariantId } from '@/lib/performance/variants';
import type {
  AccompanimentPattern,
  ChordEvent,
  ChordRootSpelling,
  InstrumentId,
  KeyMode,
  MajorKey,
  VoicingPosition,
} from '@/types';

export type ImmutableChordEvent = Omit<Readonly<ChordEvent>, 'rootSpelling' | 'voicingPosition'> & {
  readonly rootSpelling?: Readonly<ChordRootSpelling>;
  readonly voicingPosition?: VoicingPosition;
};

/** Pure input boundary; feature code adapts EditorSession into this shape. */
export type ComparisonSnapshotSource = Readonly<{
  sourceProjectId: string | null;
  title: string;
  key: MajorKey;
  mode: KeyMode;
  tempoBpm: number;
  instrumentId: InstrumentId;
  grooveId: string;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant?: string;
  accompanimentEnergy: AccompanimentEnergy;
  releaseCut: boolean;
  instrumentEffect?: InstrumentEffect;
  octaveShift: number;
  drumMode: DrumMode;
  drumBeat: DrumBeat;
  progression: readonly ChordEvent[];
}>;

export type CreationSnapshotV1 = Readonly<{
  schemaVersion: 1;
  snapshotId: string;
  sourceProjectId: string | null;
  /** Local content fingerprint, never a public share token. */
  sourceRevision: string;
  title: string;
  key: MajorKey;
  mode: KeyMode;
  bpm: number;
  beatsPerBar: number;
  progression: readonly ImmutableChordEvent[];
  grooveId: string;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant: AccompanimentVariantId;
  accompanimentEnergy: AccompanimentEnergy;
  instrumentId: InstrumentId;
  instrumentEffect: InstrumentEffect;
  releaseCut: boolean;
  octaveShift: number;
  drumMode: DrumMode;
  drumBeat: DrumBeat;
}>;

export type SnapshotFailureReason =
  | 'INVALID_PROJECT_ID'
  | 'INVALID_TITLE'
  | 'INVALID_BPM'
  | 'INVALID_SETTING'
  | 'EMPTY_PROGRESSION'
  | 'TOO_MANY_EVENTS'
  | 'DUPLICATE_EVENT_ID'
  | 'INVALID_EVENT';

export type SnapshotResult =
  | { readonly ok: true; readonly value: CreationSnapshotV1 }
  | {
      readonly ok: false;
      readonly reason: SnapshotFailureReason;
      readonly detail?: string;
    };

export type HarmonyChangedField = 'root' | 'quality' | 'extension' | 'bass' | 'duration';

export type HarmonyChangeV1 = Readonly<{
  changeId: string;
  kind: 'replace' | 'insert' | 'remove' | 'notation-only';
  baseIndex: number | null;
  variantIndex: number | null;
  baseEventId: string | null;
  variantEventId: string | null;
  changedFields: readonly HarmonyChangedField[];
  summaryKey:
    | 'replace-chord'
    | 'replace-bass'
    | 'replace-duration'
    | 'insert-chord'
    | 'remove-chord'
    | 'notation-only';
}>;

export type CompareUnsupportedReason =
  | 'MISSING_BASE'
  | 'SOURCE_PROJECT_MISMATCH'
  | 'IDENTICAL'
  | 'STALE_VARIANT'
  | 'TEMPO_MISMATCH'
  | 'METER_MISMATCH'
  | 'KEY_MISMATCH'
  | 'AUDIO_SETTING_MISMATCH'
  | 'DURATION_MISMATCH'
  | 'INSERTION_NOT_V1'
  | 'UNSUPPORTED_EVENT';

export type CompareCompatibility =
  | Readonly<{
      supported: true;
      alignment: 'one-to-one';
      totalBeats: number;
      changes: readonly HarmonyChangeV1[];
      copyKey: 'single-change' | 'multi-change';
    }>
  | Readonly<{
      supported: false;
      reason: CompareUnsupportedReason;
    }>;
