import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { analyzePairs, pairwiseAccuracy } from '../analyzePreference';
import { FIRST_LISTENING_PAIRS } from '../firstListeningSeed';
import { buildPreferenceCandidates, labelToIdMap } from '../preferenceCandidates';
import { pairsFromRanking, parseRankingLabels } from '../preferencePairs';
import { rejectOutliers } from '../popOutlierRejector';
import { scoreTransition } from '../popVoicingScore';
import type { Pop909PriorV1 } from '../types';

const prior = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../assets/quality/pop909_prior_v1.json'), 'utf8'),
) as Pop909PriorV1;

describe('preference pairs', () => {
  it('expands B > D > A into three pairs', () => {
    const items = parseRankingLabels('B > D > A', { A: 'id-a', B: 'id-b', D: 'id-d' });
    const pairs = pairsFromRanking('A', items);
    expect(pairs).toEqual([
      { progressionId: 'A', preferredId: 'id-b', rejectedId: 'id-d', preferredLabel: 'B', rejectedLabel: 'D' },
      { progressionId: 'A', preferredId: 'id-b', rejectedId: 'id-a', preferredLabel: 'B', rejectedLabel: 'A' },
      { progressionId: 'A', preferredId: 'id-d', rejectedId: 'id-a', preferredLabel: 'D', rejectedLabel: 'A' },
    ]);
  });
});

describe('preference candidates', () => {
  it('builds 5 progressions × 5 styles that all pass the hard gate', () => {
    const candidates = buildPreferenceCandidates(prior);
    expect(candidates).toHaveLength(25);
    const failed = candidates.filter((c) => !c.hardGateOk);
    expect(failed.map((c) => ({ id: c.id, errors: c.hardGateErrors }))).toEqual([]);
    for (const id of ['A', 'B', 'C', 'D', 'E']) {
      const labels = candidates.filter((c) => c.progressionId === id).map((c) => c.blindLabel);
      expect(new Set(labels).size).toBe(5);
    }
  });

  it('transposes A onto B by two semitones and keeps G/B bass as B', () => {
    const candidates = buildPreferenceCandidates(prior);
    const a = candidates.find((c) => c.id === 'A-connectedStable');
    const b = candidates.find((c) => c.id === 'B-connectedStable');
    const slash = candidates.find((c) => c.id === 'D-connectedStable');
    expect(a && b).toBeTruthy();
    expect(b!.voicings).toEqual(a!.voicings.map((row) => row.map((p) => p + 2)));
    expect(slash!.voicings[1][0] % 12).toBe(11);
  });

  it('shuffles labels deterministically and hides style in the label', () => {
    const first = labelToIdMap(buildPreferenceCandidates(prior), 'A');
    const second = labelToIdMap(buildPreferenceCandidates(prior), 'A');
    expect(first).toEqual(second);
    expect(Object.keys(first).join('')).not.toMatch(/connected|root|broken/i);
  });
});

describe('POP909 outlier rejector', () => {
  it('flags the broken candidate and does not treat median closeness as a score', () => {
    const candidates = buildPreferenceCandidates(prior);
    const connected = candidates.find((c) => c.id === 'A-connectedStable')!;
    const broken = candidates.find((c) => c.id === 'A-brokenOutlier')!;
    expect(broken.outlier.level === 'warning' || broken.outlier.level === 'reject').toBe(true);
    expect(connected.outlier.flags.length).toBeLessThan(broken.outlier.flags.length);
    const again = rejectOutliers(broken.transitions, prior);
    expect(again).toEqual(broken.outlier);
  });
});

describe('preference analysis (seed only)', () => {
  it('records feature deltas and refuses to declare a model-ready fit from 3 pairs', () => {
    const candidates = buildPreferenceCandidates(prior);
    const featuresById = Object.fromEntries(candidates.map((c) => [c.id, c.features]));
    const report = analyzePairs(FIRST_LISTENING_PAIRS, featuresById);
    expect(report.n).toBe(3);
    expect(report.readyForModel).toBe(false);
    const common = report.deltas.find((d) => d.feature === 'commonToneRate');
    expect(common?.n).toBe(3);
    expect(common?.preferredMean).toBeGreaterThan(common!.rejectedMean);
  });

  it('shows POP909 score missing the X > Y pair', () => {
    const candidates = buildPreferenceCandidates(prior);
    const scoreById: Record<string, number> = {};
    for (const c of candidates) {
      const mean = c.transitions.reduce((s, t) => s + scoreTransition(t, prior).score, 0) / c.transitions.length;
      scoreById[c.id] = mean;
    }
    expect(scoreById['A-rootReset']).toBeGreaterThan(scoreById['A-connectedStable']);
    const xy = pairwiseAccuracy(
      FIRST_LISTENING_PAIRS.filter((p) => p.preferredLabel === 'X' && p.rejectedLabel === 'Y'),
      scoreById,
    );
    expect(xy.accuracy).toBe(0);
  });
});
