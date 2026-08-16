/**
 * Render one QA case through the production Final MIDI pipeline.
 * No second generator.
 */

import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  writeSmf,
  type PerformanceSessionInput,
} from '@/lib/midiExport';
import type { AccompanimentPattern } from '@/types';

import type { QaProgression } from './progressions';

export type QaRender = {
  caseId: string;
  bytes: Uint8Array;
  plan: ReturnType<typeof buildSessionPerformancePlan>;
  snapshot: ReturnType<typeof buildFinalMidiSnapshot>;
};

export function caseIdFor(
  pattern: AccompanimentPattern,
  variantId: string,
  progressionId: string,
): string {
  return `${pattern}__${variantId}__${progressionId}`;
}

export function sessionForQa(
  pattern: AccompanimentPattern,
  variantId: string,
  progression: QaProgression,
): PerformanceSessionInput {
  return {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: variantId,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: true,
    instrumentEffect: 'off',
    drumMode: 'off',
    progression: progression.chords,
  };
}

export function renderQaCase(
  pattern: AccompanimentPattern,
  variantId: string,
  progression: QaProgression,
): QaRender {
  const plan = buildSessionPerformancePlan(sessionForQa(pattern, variantId, progression), 'pro');
  const snapshot = buildFinalMidiSnapshot(plan);
  return {
    caseId: caseIdFor(pattern, variantId, progression.id),
    bytes: writeSmf(snapshot),
    plan,
    snapshot,
  };
}
