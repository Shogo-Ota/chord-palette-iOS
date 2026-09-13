import { snapshotToPerformanceInput } from '@/lib/comparison';
import type { ComparisonDraft } from '@/features/editor/chordEvolution';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { FinalMidiSnapshot, SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import type { Tier } from '@/lib/performance/tier';
import {
  composeCompareFinalMidi,
  type ComposeCompareFinalMidiResult,
} from '@/lib/videoExport/comparison';

export type ComparePerformancePackage = Readonly<{
  base: SessionPerformancePlan;
  variant: SessionPerformancePlan;
  baseMidi: FinalMidiSnapshot;
  variantMidi: FinalMidiSnapshot;
  combinedMidi: FinalMidiSnapshot;
}>;

export type BuildComparePerformanceResult =
  | { readonly ok: true; readonly value: ComparePerformancePackage }
  | {
      readonly ok: false;
      readonly reason: Extract<ComposeCompareFinalMidiResult, { readonly ok: false }>['reason'];
    };

export function buildComparePerformance(
  draft: ComparisonDraft,
  tier: Tier,
): BuildComparePerformanceResult {
  const base = buildSessionPerformancePlan(snapshotToPerformanceInput(draft.base), tier);
  const variant = buildSessionPerformancePlan(snapshotToPerformanceInput(draft.variant), tier);
  const baseMidi = buildFinalMidiSnapshot(base);
  const variantMidi = buildFinalMidiSnapshot(variant);
  const combined = composeCompareFinalMidi(baseMidi, variantMidi);
  if (!combined.ok) return combined;

  return {
    ok: true,
    value: Object.freeze({
      base,
      variant,
      baseMidi,
      variantMidi,
      combinedMidi: combined.value,
    }),
  };
}
