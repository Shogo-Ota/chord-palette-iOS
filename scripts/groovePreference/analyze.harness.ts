/**
 * Groove Round1 descriptive analysis only.
 * No weights, model fitting, POP909 score, or Production integration.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  GROOVE_PROGRESSIONS,
  analyzeGroovePairs,
  buildGrooveCandidates,
  grooveLabelToIdMap,
  groovePairsFromRanking,
  teacherTakeFromRaw,
  type GrooveListeningSheet,
  type GroovePreferencePair,
  type RawGrooveTeacherJson,
} from '@/lib/groovePreference';

const BASE_RAW =
  require('../../src/lib/performance/humanTemplate/data/P1_A3.json') as RawGrooveTeacherJson;
const VARIATION_RAW =
  require('../../src/lib/performance/humanTemplate/data/P1_C12.json') as RawGrooveTeacherJson;
const REPO = resolve(__dirname, '../..');
const OUT = join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/groove_round1');

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function completedPairs(
  candidates: ReturnType<typeof buildGrooveCandidates>,
): GroovePreferencePair[] {
  const pairs: GroovePreferencePair[] = [];
  for (const progression of GROOVE_PROGRESSIONS) {
    const path = join(OUT, 'worksheets', `${progression.id}.json`);
    if (!existsSync(path)) continue;
    const sheet = JSON.parse(readFileSync(path, 'utf8')) as GrooveListeningSheet;
    if (!sheet.ranking) continue;
    const labels = sheet.ranking
      .split('>')
      .map((label) => label.trim())
      .filter(Boolean);
    if (labels.length !== 5) {
      throw new Error(`${progression.id}: ranking must contain all five labels`);
    }
    pairs.push(
      ...groovePairsFromRanking(
        progression.id,
        sheet.ranking,
        grooveLabelToIdMap(candidates, progression.id),
      ),
    );
  }
  return pairs;
}

describe('Groove Preference Round1 analysis', () => {
  it('expands rankings and writes descriptive feature deltas only', () => {
    const candidates = buildGrooveCandidates(
      teacherTakeFromRaw(BASE_RAW),
      teacherTakeFromRaw(VARIATION_RAW),
    );
    const pairs = completedPairs(candidates);
    const report = analyzeGroovePairs(pairs, candidates);
    writeJson(join(OUT, 'pairs.json'), {
      source: 'groove_round1 worksheets',
      pairCount: pairs.length,
      pairs,
    });
    writeJson(join(OUT, 'analysis', 'preference_deltas.json'), {
      ...report,
      questions: {
        timingDeviation: report.deltas.filter((row) =>
          ['gridDeviationMean', 'gridDeviationStd'].includes(row.feature),
        ),
        velocityContour: {
          scalarRows: report.deltas.filter((row) =>
            ['velocityMean', 'velocityStd', 'velocityRange'].includes(row.feature),
          ),
          note: 'Full velocityContour arrays remain in _analyst/KEY_DO_NOT_SHOW.json.',
        },
        timingVelocityRelation: report.deltas.filter(
          (row) => row.feature === 'timingVelocityCorrelation',
        ),
        densityAndRest: report.deltas.filter((row) =>
          ['attackGroupsPerBar', 'attackDensity', 'restRatio'].includes(row.feature),
        ),
        crossProgression:
          'Use progressionDeltas and consistentProgressionCount; three progressions are not independent pairs.',
      },
      limits: [
        'Thirty pair rows come from only three complete rankings and are not thirty independent listeners.',
        'Round1 reports associations only. It does not produce a Groove Score or Production weight.',
      ],
    });
    writeJson(join(OUT, 'analysis', 'status.json'), {
      pairCount: pairs.length,
      readyForAnalysis: report.readyForAnalysis,
      independentProgressionCount: report.independentProgressionCount,
      productionChanged: false,
      weightsCreated: false,
    });

    if (pairs.length === 0) {
      expect(report.readyForAnalysis).toBe(false);
    } else if (pairs.length === 30) {
      expect(report.readyForAnalysis).toBe(true);
      expect(report.independentProgressionCount).toBe(3);
    }
  });
});
