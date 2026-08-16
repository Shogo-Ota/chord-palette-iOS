/**
 * Preferred vs rejected feature deltas. No model weights yet.
 */

import {
  PREFERENCE_FEATURE_KEYS,
  type NumericPreferenceKey,
  type PreferenceFeatureVector,
} from './preferenceFeatures';
import type { PreferencePairRow } from './preferencePairs';

export type FeatureDeltaRow = {
  feature: NumericPreferenceKey;
  preferredMean: number;
  rejectedMean: number;
  meanDelta: number;
  n: number;
};

export function analyzePairs(
  pairs: readonly PreferencePairRow[],
  featuresById: Record<string, PreferenceFeatureVector>,
): { n: number; readyForModel: boolean; deltas: FeatureDeltaRow[] } {
  const deltas: FeatureDeltaRow[] = [];
  for (const feature of PREFERENCE_FEATURE_KEYS) {
    const pref: number[] = [];
    const rej: number[] = [];
    for (const pair of pairs) {
      const a = featuresById[pair.preferredId];
      const b = featuresById[pair.rejectedId];
      if (!a || !b) continue;
      pref.push(a[feature]);
      rej.push(b[feature]);
    }
    const n = pref.length;
    const preferredMean = n ? pref.reduce((s, x) => s + x, 0) / n : 0;
    const rejectedMean = n ? rej.reduce((s, x) => s + x, 0) / n : 0;
    deltas.push({
      feature,
      preferredMean,
      rejectedMean,
      meanDelta: preferredMean - rejectedMean,
      n,
    });
  }
  return { n: pairs.length, readyForModel: pairs.length >= 20, deltas };
}

/** Higher score is treated as preferred. Used to compare POP909 vs a future preference model. */
export function pairwiseAccuracy(
  pairs: readonly PreferencePairRow[],
  scoreById: Record<string, number>,
): { n: number; correct: number; accuracy: number } {
  let correct = 0;
  let n = 0;
  for (const pair of pairs) {
    const preferred = scoreById[pair.preferredId];
    const rejected = scoreById[pair.rejectedId];
    if (preferred == null || rejected == null) continue;
    n += 1;
    if (preferred > rejected) correct += 1;
  }
  return { n, correct, accuracy: n ? correct / n : 0 };
}
