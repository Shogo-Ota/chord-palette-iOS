/**
 * Features kept for Chord Palette preference analysis.
 * No production weights. Teacher similarity is null until a teacher take is attached.
 */

import type { TransitionFeatures } from './types';

export type PreferenceFeatureVector = {
  commonToneRate: number;
  totalVoiceMovement: number;
  meanVoiceMovement: number;
  bassMovement: number;
  topMovement: number;
  registerCenterDelta: number;
  spanDelta: number;
  inversion: number;
  rootPositionResetRate: number;
  voiceCountChange: number;
  teacherSpacingSimilarity: number | null;
  teacherTopContourSimilarity: number | null;
  teacherBassContourSimilarity: number | null;
  extensionLowRegisterRate: number;
  attackDensity: number;
};

function avg(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function absAvg(xs: readonly (number | null)[]): number {
  return avg(xs.filter((n): n is number => n != null).map((n) => Math.abs(n)));
}

export function preferenceFeaturesFromTransitions(
  rows: readonly TransitionFeatures[],
): PreferenceFeatureVector {
  const resets = rows.filter(
    (r) => r.bass.inversion === 'root' && (r.bass.bassLeapSize ?? 0) >= 3,
  ).length;
  const ext = rows.flatMap((r) => r.extensions);
  const lowExt = ext.filter((e) => e.role === 'BASS' || e.relativePosition < 0.25).length;
  return {
    commonToneRate: avg(rows.map((r) => r.voiceLeading.commonToneRate)),
    totalVoiceMovement: avg(rows.map((r) => r.voiceLeading.totalVoiceMovementSemitones)),
    meanVoiceMovement: avg(rows.map((r) => r.voiceLeading.meanVoiceMovement)),
    bassMovement: absAvg(rows.map((r) => r.bass.bassMovementSemitones)),
    topMovement: absAvg(rows.map((r) => r.top.topMovementSemitones)),
    registerCenterDelta: absAvg(rows.map((r) => r.register.registerCenterDelta)),
    spanDelta: absAvg(rows.map((r) => r.register.spanDelta)),
    inversion: avg(rows.map((r) => (r.bass.inversion === 'root' ? 1 : 0))),
    rootPositionResetRate: rows.length ? resets / rows.length : 0,
    voiceCountChange: avg(
      rows.map((r) => Math.abs(r.voiceLeading.voiceCountAfter - r.voiceLeading.voiceCountBefore)),
    ),
    teacherSpacingSimilarity: null,
    teacherTopContourSimilarity: null,
    teacherBassContourSimilarity: null,
    extensionLowRegisterRate: ext.length ? lowExt / ext.length : 0,
    attackDensity: avg(rows.map((r) => r.rhythm.attackDensityPerBeat)),
  };
}

export const PREFERENCE_FEATURE_KEYS = [
  'commonToneRate',
  'totalVoiceMovement',
  'meanVoiceMovement',
  'bassMovement',
  'topMovement',
  'registerCenterDelta',
  'spanDelta',
  'inversion',
  'rootPositionResetRate',
  'voiceCountChange',
  'extensionLowRegisterRate',
  'attackDensity',
] as const;

export type NumericPreferenceKey = (typeof PREFERENCE_FEATURE_KEYS)[number];
