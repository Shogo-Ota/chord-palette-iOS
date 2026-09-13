import type { CompareUnsupportedReason, CreationSnapshotV1 } from '@/lib/comparison';

export type CompareStoryRole = 'base' | 'variant';

export type CompareStorySegment = Readonly<{
  id: string;
  role: CompareStoryRole;
  snapshotId: string;
  startSample: number;
  durationSamples: number;
}>;

export type CompareHarmonyEvent = Readonly<{
  id: string;
  role: CompareStoryRole;
  sourceEventId: string;
  sourceIndex: number;
  displayName: string;
  startSample: number;
  durationSamples: number;
}>;

export type CompareTimePlanV1 = Readonly<{
  schemaVersion: 1;
  sampleRate: number;
  durationSamples: number;
  fpsNumerator: number;
  fpsDenominator: number;
  sourceSnapshotIds: readonly [string, string];
  segments: readonly [CompareStorySegment, CompareStorySegment];
  harmonyEvents: readonly CompareHarmonyEvent[];
}>;

export type BuildCompareTimePlanInput = Readonly<{
  base: CreationSnapshotV1 | null;
  variant: CreationSnapshotV1;
  sampleRate: number;
  fpsNumerator?: number;
  fpsDenominator?: number;
}>;

export type CompareTimePlanFailureReason =
  CompareUnsupportedReason | 'INVALID_SAMPLE_RATE' | 'INVALID_FRAME_RATE' | 'UNSAFE_DURATION';

export type CompareTimePlanResult =
  | { readonly ok: true; readonly value: CompareTimePlanV1 }
  | {
      readonly ok: false;
      readonly reason: CompareTimePlanFailureReason;
    };
