import type { CreationSnapshotV1 } from '@/lib/comparison';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import { accompanimentSpaceProfileFor } from '@/lib/performance/space/accompanimentSpaceProfile';
import { buildNativePlaybackPlan } from '@/lib/playback';
import type { RenderAudioRequest } from '@/services/audio/types';

import type { ComparePerformancePackage } from './buildComparePerformance';

export function buildCompareAudioRequest(
  source: CreationSnapshotV1,
  performance: ComparePerformancePackage,
): RenderAudioRequest {
  const native = buildNativePlaybackPlan(performance.combinedMidi, {
    loop: false,
  });
  const space = accompanimentSpaceProfileFor(source.accompanimentVariant);
  const base: SessionPerformancePlan = performance.base;

  return {
    bpm: native.bpm,
    totalBeats: native.totalBeats,
    chordEvents: [],
    drumPatternId: base.drumPatternId,
    accompaniment: source.accompanimentPattern,
    instrument: native.instrument,
    durationSec: native.totalBeats * (60 / native.bpm),
    beatsPerBar: source.beatsPerBar,
    drumMode: source.drumMode,
    midiEvents: native.midiEvents,
    hasDrums: native.hasDrums,
    gmProgram: native.gmProgram,
    planSignature: native.signature,
    reverbPreset: space.reverbPreset,
    reverbWetDryMix: space.reverbWetDryMix,
  };
}
