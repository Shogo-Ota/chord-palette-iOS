import { normalizeAccompaniment } from '@/lib/accompaniment';
import { normalizeDrumBeat } from '@/lib/drum/drumBeat';
import { normalizeDrumMode } from '@/lib/drum/drumMode';
import { normalizeVoicingPosition } from '@/lib/performance/baseVoicing/types';
import { normalizeEnergy } from '@/lib/performance/energy';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { InstrumentId } from '@/types';

import type { VideoExportInput } from './index';

/** Pure Video UI → shared performance pipeline boundary. */
export function videoPerformanceInput(input: VideoExportInput): PerformanceSessionInput {
  return {
    key: input.key,
    tempoBpm: input.bpm,
    grooveId: input.grooveId,
    accompanimentPattern: normalizeAccompaniment(input.accompaniment),
    accompanimentVariant: input.accompanimentVariant,
    instrumentId: input.instrumentId as InstrumentId,
    accompanimentEnergy: normalizeEnergy(input.accompanimentEnergy),
    voicingPosition: normalizeVoicingPosition(input.voicingPosition),
    octaveShift: input.octaveShift ?? 0,
    releaseCut: input.releaseCut !== false,
    drumMode: normalizeDrumMode(input.drumMode),
    drumBeat: normalizeDrumBeat(input.drumBeat),
    instrumentEffect: input.instrumentEffect,
    progression: input.progression,
  };
}
