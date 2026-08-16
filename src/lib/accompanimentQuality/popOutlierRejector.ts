/**
 * POP909 as an outlier rejector only.
 * "Close to the median" is not a high score. Extreme tails get a warning or reject.
 * Never added into a ranking total.
 */

import type { NumericSummary, Pop909PriorV1, TransitionFeatures } from './types';

export type OutlierLevel = 'ok' | 'warning' | 'reject';

export type OutlierFlag = {
  feature: string;
  value: number;
  bound: 'p90' | 'p95' | 'p10' | 'p5-proxy';
  level: OutlierLevel;
};

export type OutlierReport = {
  level: OutlierLevel;
  flags: OutlierFlag[];
};

function absMean(rows: readonly TransitionFeatures[], pick: (r: TransitionFeatures) => number | null): number {
  const xs = rows.map(pick).filter((n): n is number => n != null && Number.isFinite(n));
  if (xs.length === 0) return 0;
  return xs.reduce((s, n) => s + Math.abs(n), 0) / xs.length;
}

function meanOf(rows: readonly TransitionFeatures[], pick: (r: TransitionFeatures) => number | null): number {
  const xs = rows.map(pick).filter((n): n is number => n != null && Number.isFinite(n));
  if (xs.length === 0) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function tail(value: number, dist: NumericSummary, name: string, absValue = false): OutlierFlag | null {
  if (dist.count < 8) return null;
  const v = absValue ? Math.abs(value) : value;
  if (v > dist.p95) return { feature: name, value: v, bound: 'p95', level: 'reject' };
  if (v > dist.p90) return { feature: name, value: v, bound: 'p90', level: 'warning' };
  if (!absValue && v < dist.p10) return { feature: name, value: v, bound: 'p10', level: 'warning' };
  return null;
}

/** Aggregate one candidate (all its transitions) against the POP909 tails. */
export function rejectOutliers(
  transitions: readonly TransitionFeatures[],
  prior: Pop909PriorV1,
): OutlierReport {
  const flags: OutlierFlag[] = [];
  const checks: Array<OutlierFlag | null> = [
    tail(meanOf(transitions, (r) => r.register.registerCenter), prior.register.center, 'registerCenter'),
    tail(absMean(transitions, (r) => r.register.registerCenterDelta), prior.register.centerDelta, 'registerCenterDelta', true),
    tail(absMean(transitions, (r) => r.register.spanDelta), prior.register.spanDelta, 'spanDelta', true),
    tail(meanOf(transitions, (r) => r.register.totalSpan), prior.register.span, 'span'),
    tail(absMean(transitions, (r) => r.bass.bassLeapSize), prior.voiceLeading.bassMovement, 'bassLeap', true),
    tail(absMean(transitions, (r) => r.top.topMovementSemitones), prior.top.movement, 'topLeap', true),
    tail(
      absMean(transitions, (r) => r.voiceLeading.totalVoiceMovementSemitones),
      prior.voiceLeading.totalVoiceMovement,
      'totalVoiceMovement',
      true,
    ),
  ];
  for (const f of checks) if (f) flags.push(f);
  const level: OutlierLevel = flags.some((f) => f.level === 'reject')
    ? 'reject'
    : flags.some((f) => f.level === 'warning')
      ? 'warning'
      : 'ok';
  return { level, flags };
}
