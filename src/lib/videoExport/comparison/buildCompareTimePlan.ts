import { compareCompatibility, type CreationSnapshotV1 } from '@/lib/comparison';
import { remeterScale } from '@/lib/performance/meter';

import type {
  BuildCompareTimePlanInput,
  CompareHarmonyEvent,
  CompareStoryRole,
  CompareTimePlanResult,
} from './contracts';

const MAX_SAMPLE_RATE = 384_000;
const MAX_FPS = 240;

function samplesAtAuthoredBeat(
  authoredBeat: number,
  snapshot: CreationSnapshotV1,
  sampleRate: number,
): number {
  const performedBeat = authoredBeat * remeterScale(snapshot.beatsPerBar);
  return Math.round(performedBeat * (60 / snapshot.bpm) * sampleRate);
}

function cycleSamples(snapshot: CreationSnapshotV1, sampleRate: number): number {
  const total = snapshot.progression.reduce((sum, event) => sum + event.durationBeats, 0);
  return samplesAtAuthoredBeat(total, snapshot, sampleRate);
}

function harmonyEvents(
  snapshot: CreationSnapshotV1,
  role: CompareStoryRole,
  offsetSamples: number,
  sampleRate: number,
): readonly CompareHarmonyEvent[] {
  let authoredBeat = 0;
  return Object.freeze(
    snapshot.progression.map((event, sourceIndex) => {
      const relativeStart = samplesAtAuthoredBeat(authoredBeat, snapshot, sampleRate);
      authoredBeat += event.durationBeats;
      const relativeEnd = samplesAtAuthoredBeat(authoredBeat, snapshot, sampleRate);
      return Object.freeze({
        id: `${role}:${event.id}:${sourceIndex}`,
        role,
        sourceEventId: event.id,
        sourceIndex,
        displayName: event.displayName,
        startSample: offsetSamples + relativeStart,
        durationSamples: relativeEnd - relativeStart,
      });
    }),
  );
}

export function buildCompareTimePlan(input: BuildCompareTimePlanInput): CompareTimePlanResult {
  const compatibility = compareCompatibility(input.base, input.variant);
  if (!compatibility.supported) {
    return { ok: false, reason: compatibility.reason };
  }
  const base = input.base!;
  if (
    !Number.isSafeInteger(input.sampleRate) ||
    input.sampleRate <= 0 ||
    input.sampleRate > MAX_SAMPLE_RATE
  ) {
    return { ok: false, reason: 'INVALID_SAMPLE_RATE' };
  }

  const fpsNumerator = input.fpsNumerator ?? 30;
  const fpsDenominator = input.fpsDenominator ?? 1;
  if (
    !Number.isSafeInteger(fpsNumerator) ||
    !Number.isSafeInteger(fpsDenominator) ||
    fpsNumerator <= 0 ||
    fpsNumerator > MAX_FPS ||
    fpsDenominator <= 0
  ) {
    return { ok: false, reason: 'INVALID_FRAME_RATE' };
  }

  const baseSamples = cycleSamples(base, input.sampleRate);
  const variantSamples = cycleSamples(input.variant, input.sampleRate);
  const durationSamples = baseSamples + variantSamples;
  if (
    baseSamples <= 0 ||
    variantSamples <= 0 ||
    baseSamples !== variantSamples ||
    !Number.isSafeInteger(durationSamples)
  ) {
    return { ok: false, reason: 'UNSAFE_DURATION' };
  }

  const baseSegment = Object.freeze({
    id: 'story:base',
    role: 'base' as const,
    snapshotId: base.snapshotId,
    startSample: 0,
    durationSamples: baseSamples,
  });
  const variantSegment = Object.freeze({
    id: 'story:variant',
    role: 'variant' as const,
    snapshotId: input.variant.snapshotId,
    startSample: baseSamples,
    durationSamples: variantSamples,
  });
  const segments = Object.freeze([baseSegment, variantSegment] as const);
  const events = Object.freeze([
    ...harmonyEvents(base, 'base', 0, input.sampleRate),
    ...harmonyEvents(input.variant, 'variant', baseSamples, input.sampleRate),
  ]);
  if (
    events.some(
      (event) =>
        !Number.isSafeInteger(event.startSample) ||
        !Number.isSafeInteger(event.durationSamples) ||
        event.durationSamples <= 0 ||
        event.startSample < 0 ||
        event.startSample + event.durationSamples > durationSamples,
    )
  ) {
    return { ok: false, reason: 'UNSAFE_DURATION' };
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 1,
      sampleRate: input.sampleRate,
      durationSamples,
      fpsNumerator,
      fpsDenominator,
      sourceSnapshotIds: Object.freeze([base.snapshotId, input.variant.snapshotId] as const),
      segments,
      harmonyEvents: events,
    }),
  };
}
