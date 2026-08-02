/**
 * The Phase 9 report builds cleanly over the whole catalog and stays honest:
 * fixed seed, zero invariant violations, every progression × rhythm covered.
 *
 * Doubling as the report GENERATOR: set ACCOMPANIMENT_REPORT to a path (bash:
 * `ACCOMPANIMENT_REPORT=docs/performance/reports/foo.json npx jest accompanimentReport`)
 * and the built report is written there for before/after comparison.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import { buildAccompanimentReport, REPORT_SEED } from '@/lib/performance/analysis/report';

describe('accompaniment quality report', () => {
  const report = buildAccompanimentReport();

  it('covers every fixed progression × every rhythm', () => {
    expect(report.seed).toBe(REPORT_SEED);
    expect(report.entries).toHaveLength(EVAL_PROGRESSIONS.length * ACCOMPANIMENT_IDS.length);
    for (const id of ACCOMPANIMENT_IDS) {
      expect(report.entries.filter((e) => e.rhythm === id)).toHaveLength(
        EVAL_PROGRESSIONS.length,
      );
    }
  });

  it('reports zero MIDI-invariant violations across the whole catalog', () => {
    for (const e of report.entries) {
      expect(e.metrics.invalidNoteCount).toBe(0);
      expect(e.metrics.totalNotes).toBeGreaterThan(0);
      expect(e.metrics.maxPolyphony).toBeGreaterThan(0);
    }
  });

  it('carries axis coordinates on every entry', () => {
    for (const e of report.entries) {
      expect(e.style).toBeDefined();
      expect(e.feel).toBeDefined();
    }
  });

  it('writes the report JSON when ACCOMPANIMENT_REPORT is set', () => {
    const target = process.env.ACCOMPANIMENT_REPORT;
    if (!target) return; // generator mode only
    const abs = path.resolve(process.cwd(), target);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2));
    expect(fs.existsSync(abs)).toBe(true);
  });
});
