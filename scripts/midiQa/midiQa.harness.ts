/**
 * MIDI QA corpus + baseline report.
 *
 * Renders every Production Pattern × Type × progression A–F through
 * buildSessionPerformancePlan → buildFinalMidiSnapshot (the app path).
 *
 * Env:
 *   MIDI_QA_OUT       output root (default LocalAnalysis/midi_qa)
 *   MIDI_QA_PROMOTE   if "1", copy current/*.mid into golden/
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildReport,
  compareGolden,
  compareTranspose,
  productionSlots,
  QA_PROGRESSIONS,
  renderQaCase,
  renderReportMarkdown,
  songFromSmfBytes,
  validateCase,
  type CaseVerdict,
} from '@/lib/midiQa';
import type { GoldenDiff, TransposePairResult } from '@/lib/midiQa/types';

const ROOT = resolve(process.env.MIDI_QA_OUT ?? 'LocalAnalysis/midi_qa');
const CURRENT = join(ROOT, 'current');
const GOLDEN = join(ROOT, 'golden');
const PROMOTE = process.env.MIDI_QA_PROMOTE === '1';

describe('MIDI QA corpus', () => {
  it('generates, validates, and writes the baseline report', () => {
    mkdirSync(CURRENT, { recursive: true });
    mkdirSync(GOLDEN, { recursive: true });

    const slots = productionSlots();
    const cases: CaseVerdict[] = [];
    const snapshots = new Map<string, ReturnType<typeof renderQaCase>>();

    for (const slot of slots) {
      for (const prog of QA_PROGRESSIONS) {
        const rendered = renderQaCase(slot.pattern, slot.variantId, prog);
        const midPath = join(CURRENT, `${rendered.caseId}.mid`);
        writeFileSync(midPath, rendered.bytes);
        snapshots.set(rendered.caseId, rendered);
        cases.push(
          validateCase(
            rendered.caseId,
            slot.pattern,
            slot.variantId,
            prog.id,
            rendered.snapshot,
            rendered.plan,
          ),
        );
        if (PROMOTE) {
          copyFileSync(midPath, join(GOLDEN, `${rendered.caseId}.mid`));
        }
      }
    }

    const transpose: TransposePairResult[] = [];
    for (const slot of slots) {
      const a = snapshots.get(`${slot.pattern}__${slot.variantId}__A`);
      const b = snapshots.get(`${slot.pattern}__${slot.variantId}__B`);
      if (!a || !b) continue;
      transpose.push(compareTranspose(slot.pattern, slot.variantId, a.snapshot, b.snapshot));
    }

    const golden: GoldenDiff[] = cases.map((c) => {
      const goldenPath = join(GOLDEN, `${c.analysis.caseId}.mid`);
      const current = snapshots.get(c.analysis.caseId);
      if (!current) {
        return compareGolden(c.analysis.caseId, { notes: [], cc64: [] }, null);
      }
      const goldenSong = existsSync(goldenPath)
        ? songFromSmfBytes(new Uint8Array(readFileSync(goldenPath)))
        : null;
      return compareGolden(c.analysis.caseId, songFromSmfBytes(current.bytes), goldenSong);
    });

    const report = buildReport(cases, transpose, golden);
    writeFileSync(join(ROOT, 'report.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(ROOT, 'report.md'), renderReportMarkdown(report));

    // eslint-disable-next-line no-console
    console.log(renderReportMarkdown(report));

    expect(report.corpus).toBe(slots.length * QA_PROGRESSIONS.length);
  });
});
