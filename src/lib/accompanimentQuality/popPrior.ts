import type { CategoryDistribution, NumericSummary, Pop909PriorV1, TransitionFeatures } from './types';

export const ANALYZER_VERSION = 'pop909-prior-v1.0.0';

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}

export function summarize(values: readonly number[]): NumericSummary {
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const count = sorted.length;
  if (count === 0) {
    return { count: 0, mean: 0, std: 0, p10: 0, p25: 0, median: 0, p75: 0, p90: 0, p95: 0 };
  }
  const mean = sorted.reduce((s, n) => s + n, 0) / count;
  const variance = sorted.reduce((s, n) => s + (n - mean) ** 2, 0) / count;
  return {
    count,
    mean,
    std: Math.sqrt(variance),
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    p95: quantile(sorted, 0.95),
  };
}

export function categorize(values: readonly string[]): CategoryDistribution {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length || 1;
  const out: CategoryDistribution = {};
  for (const key of [...counts.keys()].sort()) {
    const count = counts.get(key) ?? 0;
    out[key] = { count, probability: count / total };
  }
  return out;
}

function nums(rows: readonly TransitionFeatures[], pick: (r: TransitionFeatures) => number | null): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = pick(r);
    if (v != null && Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function buildPopPrior(
  rows: readonly TransitionFeatures[],
  meta: Omit<Pop909PriorV1['metadata'], 'analyzerVersion'> & { dataset: string },
): Pop909PriorV1 {
  const extRoles: Record<string, string[]> = {};
  const extReg: Record<string, number[]> = {};
  const extHigh: Record<string, { high: number; n: number }> = {};
  for (const row of rows) {
    for (const ext of row.extensions) {
      (extRoles[ext.degree] ??= []).push(ext.role);
      (extReg[ext.degree] ??= []).push(ext.relativePosition);
      const slot = (extHigh[ext.degree] ??= { high: 0, n: 0 });
      slot.n += 1;
      if (ext.isHighest) slot.high += 1;
    }
  }
  const extensions: Pop909PriorV1['extensions'] = {};
  for (const degree of Object.keys(extRoles).sort()) {
    extensions[degree] = {
      roleProbability: categorize(extRoles[degree] ?? []),
      relativeRegister: summarize(extReg[degree] ?? []),
      isHighestRate: (extHigh[degree]?.n ?? 0) === 0 ? 0 : (extHigh[degree]?.high ?? 0) / (extHigh[degree]?.n ?? 1),
    };
  }

  return {
    version: 1,
    dataset: meta.dataset,
    metadata: {
      analyzerVersion: ANALYZER_VERSION,
      date: meta.date,
      gitCommit: meta.gitCommit,
      songCount: meta.songCount,
      includedSampleCount: meta.includedSampleCount,
      excludedSampleCount: meta.excludedSampleCount,
      exclusionReasons: meta.exclusionReasons,
      pocSongLimit: meta.pocSongLimit,
    },
    voiceLeading: {
      meanVoiceMovement: summarize(nums(rows, (r) => r.voiceLeading.meanVoiceMovement)),
      totalVoiceMovement: summarize(nums(rows, (r) => r.voiceLeading.totalVoiceMovementSemitones)),
      maxVoiceMovement: summarize(nums(rows, (r) => r.voiceLeading.maxVoiceMovement)),
      topMovement: summarize(nums(rows, (r) => r.top.topMovementSemitones)),
      bassMovement: summarize(nums(rows, (r) => r.bass.bassMovementSemitones)),
      commonToneRate: summarize(nums(rows, (r) => r.voiceLeading.commonToneRate)),
      voiceCrossing: summarize(nums(rows, (r) => r.voiceLeading.voiceCrossing)),
    },
    register: {
      center: summarize(nums(rows, (r) => r.register.registerCenter)),
      centerDelta: summarize(nums(rows, (r) => r.register.registerCenterDelta)),
      span: summarize(nums(rows, (r) => r.register.totalSpan)),
      spanDelta: summarize(nums(rows, (r) => r.register.spanDelta)),
      lowest: summarize(nums(rows, (r) => r.register.lowestPitch)),
      highest: summarize(nums(rows, (r) => r.register.highestPitch)),
    },
    bass: {
      degreeProbability: categorize(rows.map((r) => r.bass.bassDegree)),
      inversionProbability: categorize(rows.map((r) => r.bass.inversion)),
    },
    top: {
      degreeProbability: categorize(rows.map((r) => r.top.topDegree)),
      movement: summarize(nums(rows, (r) => r.top.topMovementSemitones)),
    },
    extensions,
  };
}

export function validatePopPrior(prior: Pop909PriorV1): string[] {
  const errors: string[] = [];
  if (prior.version !== 1) errors.push(`version ${prior.version} != 1`);
  if (!prior.dataset) errors.push('dataset missing');
  if (prior.metadata.includedSampleCount <= 0) errors.push('includedSampleCount is 0');
  const summaries = [
    prior.voiceLeading.meanVoiceMovement,
    prior.voiceLeading.commonToneRate,
    prior.register.span,
    prior.top.movement,
  ];
  for (const s of summaries) {
    if (s.count <= 0) errors.push('empty numeric summary');
    if (s.p10 > s.median || s.median > s.p90) errors.push('percentiles out of order');
  }
  return errors;
}
