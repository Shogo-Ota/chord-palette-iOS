/**
 * Accompaniment quality report (implementation_v1.01 Phase 9).
 *
 * Renders the four fixed evaluation progressions (A–D) with every selector
 * rhythm — the exact playback path (voice leading → remeter → generate) at a
 * fixed seed — and reduces each take to its metric set. Because inputs and seed
 * never move, two reports differ only where the ENGINE changed; that is what
 * makes a before/after comparison honest.
 *
 * Generate the baseline JSON with (bash):
 *   ACCOMPANIMENT_REPORT=docs/performance/reports/<name>.json npx jest accompanimentReport
 */

import { generatePerformance } from '../PerformanceEngine';
import { progressionToPerfChords } from '../progressionInput';
import { remeterChords } from '../meter';
import { beatsPerBarFor, RHYTHM_IDS } from '../rhythms';
import { axesFor } from '../model';
import { EVAL_PROGRESSIONS } from './fixtures';
import { computeMetrics, type PerformanceMetrics } from './metrics';

/** The seed every report renders with — comparisons require it to never move. */
export const REPORT_SEED = 20260802;

export interface ReportEntry {
  progression: string;
  rhythm: string;
  /** Axis coordinates, so grouped comparisons (per style/feel) need no lookup. */
  style?: string;
  feel?: string;
  bpm: number;
  metrics: PerformanceMetrics;
}

export interface AccompanimentReport {
  seed: number;
  generatedAt: string;
  entries: ReportEntry[];
}

/** Build the full report: 4 progressions × every rhythm in the catalog. */
export function buildAccompanimentReport(): AccompanimentReport {
  const entries: ReportEntry[] = [];
  for (const prog of EVAL_PROGRESSIONS) {
    const authored = progressionToPerfChords(prog.chords, prog.key);
    for (const rhythm of RHYTHM_IDS) {
      const chords = remeterChords(authored, beatsPerBarFor(rhythm));
      const notes = generatePerformance(
        { chords, bpm: prog.bpm, seed: REPORT_SEED },
        { styleId: rhythm, drums: true },
      );
      const axes = axesFor(rhythm);
      entries.push({
        progression: `${prog.id}: ${prog.name} @ ${prog.bpm}`,
        rhythm,
        style: axes?.style,
        feel: axes?.feel,
        bpm: prog.bpm,
        metrics: computeMetrics(notes, chords),
      });
    }
  }
  return { seed: REPORT_SEED, generatedAt: new Date().toISOString(), entries };
}
