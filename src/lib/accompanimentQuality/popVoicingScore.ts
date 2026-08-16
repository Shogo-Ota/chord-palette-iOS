/**
 * PopVoicingScore v0 — retired for Production ranking.
 * Blind listening (X > Y > Z vs score Y > X > Z) showed POP909 frequency
 * is not Chord Palette preference. Keep for diagnostics / comparison only.
 * Hard contracts stay outside. Do not add this score into a ranking total.
 */

import type { NumericSummary, Pop909PriorV1, PopVoicingScoreBreakdown, TransitionFeatures } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 100 near the median, falling off with robust z (IQR). Extra penalty outside p10–p90.
 */
export function densityScore(value: number, dist: NumericSummary): number {
  if (dist.count < 8) return 50;
  const iqr = Math.max(dist.p75 - dist.p25, 0.5);
  const z = Math.abs(value - dist.median) / iqr;
  let score = 100 * Math.exp(-0.5 * z * z);
  if (value < dist.p10 || value > dist.p90) score *= 0.72;
  if (value < dist.p10 - iqr || value > dist.p90 + iqr) score *= 0.55;
  return clamp(score, 0, 100);
}

function categoryScore(label: string, dist: Record<string, { probability: number }>): number {
  const p = dist[label]?.probability;
  if (p == null) return 35;
  return clamp(40 + p * 80, 0, 100);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

export function scoreTransition(
  features: TransitionFeatures,
  prior: Pop909PriorV1,
): PopVoicingScoreBreakdown {
  const warnings: string[] = [];
  const vl = mean([
    densityScore(features.voiceLeading.meanVoiceMovement, prior.voiceLeading.meanVoiceMovement),
    densityScore(features.voiceLeading.commonToneRate, prior.voiceLeading.commonToneRate),
    densityScore(features.voiceLeading.maxVoiceMovement, prior.voiceLeading.maxVoiceMovement),
  ]);
  const register = mean([
    densityScore(features.register.registerCenter, prior.register.center),
    densityScore(Math.abs(features.register.registerCenterDelta ?? 0), {
      ...prior.register.centerDelta,
      median: 0,
    }),
    densityScore(features.register.totalSpan, prior.register.span),
    densityScore(Math.abs(features.register.spanDelta ?? 0), { ...prior.register.spanDelta, median: 0 }),
  ]);
  const bass = mean([
    densityScore(Math.abs(features.bass.bassMovementSemitones ?? 0), {
      ...prior.voiceLeading.bassMovement,
      // leap size vs signed movement: use |x| against |movement| spread
    }),
    categoryScore(features.bass.bassDegree, prior.bass.degreeProbability),
    categoryScore(features.bass.inversion, prior.bass.inversionProbability),
  ]);
  const top = mean([
    densityScore(Math.abs(features.top.topMovementSemitones ?? 0), prior.top.movement),
    categoryScore(features.top.topDegree, prior.top.degreeProbability),
  ]);

  let extension = 80;
  if (features.extensions.length > 0) {
    const parts: number[] = [];
    for (const ext of features.extensions) {
      const slot = prior.extensions[ext.degree];
      if (!slot) {
        parts.push(55);
        continue;
      }
      parts.push(categoryScore(ext.role, slot.roleProbability));
      parts.push(densityScore(ext.relativePosition, slot.relativeRegister));
      if (ext.role === 'BASS') {
        parts.push(25);
        warnings.push(`${ext.degree} placed in BASS (rare in POP909 prior)`);
      }
    }
    extension = mean(parts);
  }

  if (features.voiceLeading.maxVoiceMovement > prior.voiceLeading.maxVoiceMovement.p90) {
    warnings.push('max voice movement above POP909 p90');
  }
  if (Math.abs(features.top.topMovementSemitones ?? 0) > prior.top.movement.p90) {
    warnings.push('top voice movement above POP909 p90');
  }
  if (Math.abs(features.register.registerCenterDelta ?? 0) > prior.register.centerDelta.p90) {
    warnings.push('register center change above POP909 p90');
  }
  if (features.voiceLeading.voiceCrossing > 0) {
    warnings.push(`voice crossing count ${features.voiceLeading.voiceCrossing} (soft; hard gate is separate)`);
  }

  const score = mean([vl, register, bass, top, extension]);
  return {
    score: Math.round(score),
    components: {
      voiceLeading: Math.round(vl),
      register: Math.round(register),
      bass: Math.round(bass),
      top: Math.round(top),
      extension: Math.round(extension),
    },
    warnings,
  };
}
