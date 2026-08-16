import type {
  GrooveCandidate,
  GrooveFeatureVector,
  GroovePreferencePair,
  GrooveProgression,
} from './types';

export type GrooveScalarFeature =
  | 'attackGroupsPerBar'
  | 'attackDensity'
  | 'restRatio'
  | 'offBeatRatio'
  | 'syncopation'
  | 'ioiMean'
  | 'ioiStd'
  | 'ioiVariation'
  | 'gridDeviationMean'
  | 'gridDeviationStd'
  | 'velocityMean'
  | 'velocityStd'
  | 'velocityRange'
  | 'timingVelocityCorrelation'
  | 'durationMedian'
  | 'articulationRatio'
  | 'cc64Coverage'
  | 'phraseRepetitionSimilarity'
  | 'phraseVariationAmount';

export const GROOVE_SCALAR_FEATURES: readonly GrooveScalarFeature[] = [
  'attackGroupsPerBar',
  'attackDensity',
  'restRatio',
  'offBeatRatio',
  'syncopation',
  'ioiMean',
  'ioiStd',
  'ioiVariation',
  'gridDeviationMean',
  'gridDeviationStd',
  'velocityMean',
  'velocityStd',
  'velocityRange',
  'timingVelocityCorrelation',
  'durationMedian',
  'articulationRatio',
  'cc64Coverage',
  'phraseRepetitionSimilarity',
  'phraseVariationAmount',
];

function scalar(features: GrooveFeatureVector, key: GrooveScalarFeature): number {
  switch (key) {
    case 'ioiMean':
      return features.ioiDistribution.mean;
    case 'ioiStd':
      return features.ioiDistribution.std;
    default:
      return features[key];
  }
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export type GrooveDeltaRow = {
  feature: GrooveScalarFeature;
  preferredMean: number;
  rejectedMean: number;
  meanDelta: number;
  n: number;
  progressionDeltas: Partial<Record<GrooveProgression['id'], number>>;
  consistentProgressionCount: number;
};

export function analyzeGroovePairs(
  pairs: readonly GroovePreferencePair[],
  candidates: readonly GrooveCandidate[],
): {
  pairCount: number;
  readyForAnalysis: boolean;
  independentProgressionCount: number;
  deltas: GrooveDeltaRow[];
} {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const deltas = GROOVE_SCALAR_FEATURES.map((feature): GrooveDeltaRow => {
    const preferred: number[] = [];
    const rejected: number[] = [];
    const byProgression = new Map<GrooveProgression['id'], number[]>();
    for (const pair of pairs) {
      const a = byId.get(pair.preferredId);
      const b = byId.get(pair.rejectedId);
      if (!a || !b) continue;
      const av = scalar(a.features, feature);
      const bv = scalar(b.features, feature);
      preferred.push(av);
      rejected.push(bv);
      const list = byProgression.get(pair.progressionId) ?? [];
      list.push(av - bv);
      byProgression.set(pair.progressionId, list);
    }
    const meanDelta = mean(preferred) - mean(rejected);
    const progressionDeltas = Object.fromEntries(
      [...byProgression.entries()].map(([id, values]) => [id, mean(values)]),
    ) as Partial<Record<GrooveProgression['id'], number>>;
    const sign = Math.sign(meanDelta);
    const consistentProgressionCount = Object.values(progressionDeltas).filter(
      (delta) => delta != null && (sign === 0 ? Math.abs(delta) < 1e-9 : Math.sign(delta) === sign),
    ).length;
    return {
      feature,
      preferredMean: mean(preferred),
      rejectedMean: mean(rejected),
      meanDelta,
      n: preferred.length,
      progressionDeltas,
      consistentProgressionCount,
    };
  });

  return {
    pairCount: pairs.length,
    readyForAnalysis: pairs.length >= 30,
    independentProgressionCount: new Set(pairs.map((pair) => pair.progressionId)).size,
    deltas,
  };
}
