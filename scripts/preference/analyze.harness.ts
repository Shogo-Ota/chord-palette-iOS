/**
 * Preferred vs rejected feature deltas.
 * Does not fit production weights. Needs ≥20 pairs before readyForModel.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  FIRST_LISTENING_PAIRS,
  analyzePairs,
  buildPreferenceCandidates,
  labelToIdMap,
  pairsFromRankingString,
  pairwiseAccuracy,
  type Pop909PriorV1,
  type PreferencePairRow,
} from '@/lib/accompanimentQuality';
import { scoreTransition } from '@/lib/accompanimentQuality/popVoicingScore';
import type { ProgressionListeningSheet } from '@/lib/accompanimentQuality/listeningTypes';
import { PREFERENCE_PROGRESSIONS } from '@/lib/accompanimentQuality/preferenceCandidates';

const REPO = resolve(__dirname, '../..');
const PRIOR = join(REPO, 'assets/quality/pop909_prior_v1.json');
const ROUND = join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/round1');

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function loadFilledPairs(
  candidates: ReturnType<typeof buildPreferenceCandidates>,
): PreferencePairRow[] {
  const pairs: PreferencePairRow[] = [];
  for (const prog of PREFERENCE_PROGRESSIONS) {
    const sheetPath = join(ROUND, 'worksheets', `${prog.id}.json`);
    if (!existsSync(sheetPath)) continue;
    const sheet = JSON.parse(readFileSync(sheetPath, 'utf8')) as ProgressionListeningSheet;
    if (!sheet.ranking) continue;
    pairs.push(...pairsFromRankingString(prog.id, sheet.ranking, labelToIdMap(candidates, prog.id)));
  }
  return pairs;
}

describe('preference pair analysis', () => {
  it('writes feature deltas and will not fit weights below 20 pairs', () => {
    const prior = JSON.parse(readFileSync(PRIOR, 'utf8')) as Pop909PriorV1;
    const candidates = buildPreferenceCandidates(prior);
    const filled = loadFilledPairs(candidates);
    const pairs = filled.length > 0 ? filled : [...FIRST_LISTENING_PAIRS];
    const source = filled.length > 0 ? 'round1-worksheets' : 'first-listening-seed';

    const featuresById = Object.fromEntries(candidates.map((c) => [c.id, c.features]));
    const report = analyzePairs(pairs, featuresById);

    const scoreById: Record<string, number> = {};
    for (const c of candidates) {
      scoreById[c.id] =
        c.transitions.reduce((s, t) => s + scoreTransition(t, prior).score, 0) / c.transitions.length;
    }
    const pop909 = pairwiseAccuracy(pairs, scoreById);

    const outDir = join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/analysis');
    writeJson(join(outDir, 'preference_deltas.json'), {
      source,
      pairCount: report.n,
      readyForModel: report.readyForModel,
      pop909PairAccuracy: pop909,
      deltas: report.deltas,
      note: 'Do not turn these deltas into production weights until readyForModel is true and a later blind test passes.',
    });
    if (filled.length > 0) {
      writeJson(join(ROUND, 'pairs.json'), { source, pairs });
    }

    expect(report.n).toBeGreaterThanOrEqual(3);
    if (source === 'first-listening-seed') {
      expect(report.readyForModel).toBe(false);
      expect(pop909.accuracy).toBeLessThan(1);
    }
  });
});
