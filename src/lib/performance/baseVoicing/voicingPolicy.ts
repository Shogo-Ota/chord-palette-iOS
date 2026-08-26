/**
 * Shared Compact Base Voicing Policy v2.
 *
 * Pure interval / register / role evaluation. No chord-symbol branches, no Style
 * input, no Teacher MIDI. Hard rejects stay rare; spacing and dissonance are
 * mostly soft costs so legal tension (♭9, maj7, etc.) is never deleted to "fix"
 * muddiness — only moved or spread.
 */

import { wrapPc } from '../humanTemplate/degreeRoles';
import type { BaseVoicingNote, BaseVoicingPreference } from './types';

/**
 * Extreme low-register minor seconds (below E3 at octaveShift 0) are rejected.
 * Aligns with compact RH.lo = 48 and the historical soft cutoff at 55: the
 * bottom of the RH window may legally hold a tone, but not a cluster.
 */
export const LOW_CLUSTER_HARD_CEILING = 52;

export const VOICING_POLICY = {
  LOW_CLUSTER_HARD_CEILING,
  /** 4-note RH packed into a tritone or less is a dumpling, not a voicing. */
  CLUSTER_DENSITY_SPAN: 5,
  CLUSTER_DENSITY_MIN_NOTES: 4,
  RH_REGISTER_LO: 48,
  RH_REGISTER_HI: 72,
  CONTINUITY_WEIGHT: 0.72,
  INVERSION_ANCHOR_PENALTY: 9,
  GUIDE_TONE_ABSENCE: 90,
  TENSION_ABSENCE: 95,
  ROOT_ABSENCE: 28,
  PERFECT_FIFTH_ABSENCE: 1.5,
} as const;

export type IntervalRole =
  'root' | 'third' | 'fifth' | 'alteredFifth' | 'seventh' | 'naturalTension' | 'alteredTension';

export type DissonanceKind = 'structural' | 'tension';

export type VoicingPolicyContext = {
  rootPc: number;
  availableIntervals: readonly number[];
  preferredRightAnchorPc?: number;
};

export type VoicingPolicyBreakdown = {
  hardReject: boolean;
  spacingCost: number;
  dissonanceCost: number;
  harmonicRoleCost: number;
  duplicationCost: number;
  inversionAnchorCost: number;
  totalSoftCost: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function intervalRole(interval: number): IntervalRole {
  if (interval === 13 || interval === 1 || interval === 15 || interval === 18 || interval === 20) {
    return 'alteredTension';
  }
  if (interval === 14 || interval === 2 || interval === 17 || interval === 5 || interval === 21) {
    return 'naturalTension';
  }
  const normalized = wrapPc(interval);
  if (normalized === 0) return 'root';
  if (normalized === 3 || normalized === 4) return 'third';
  if (normalized === 6 || normalized === 8) return 'alteredFifth';
  if (normalized === 7) return 'fifth';
  if (normalized === 10 || normalized === 11) return 'seventh';
  if (normalized === 9) return 'naturalTension';
  return 'fifth';
}

export function isTensionRole(role: IntervalRole): boolean {
  return role === 'naturalTension' || role === 'alteredTension';
}

export function isGuideRole(role: IntervalRole): boolean {
  return role === 'third' || role === 'seventh' || role === 'alteredFifth' || isTensionRole(role);
}

function rightHand(notes: readonly BaseVoicingNote[]): BaseVoicingNote[] {
  return notes.filter((note) => note.hand === 'RH').sort((left, right) => left.pitch - right.pitch);
}

function registerT(pitch: number, octaveShift: number): number {
  const lo = VOICING_POLICY.RH_REGISTER_LO + octaveShift * 12;
  const hi = VOICING_POLICY.RH_REGISTER_HI + octaveShift * 12;
  return clamp01((pitch - lo) / Math.max(1, hi - lo));
}

/**
 * Lower pitches pay more. Tension clusters are cheaper than structural ones
 * (maj7 root/7th) but never free — ♭9 still wants air.
 */
export function minorSecondPenalty(
  lowPitch: number,
  highPitch: number,
  kind: DissonanceKind,
  octaveShift: number,
): number {
  const t = registerT((lowPitch + highPitch) / 2, octaveShift);
  const structural = 44 * (1 - t) + 10 * t;
  const tension = 26 * (1 - t) + 6 * t;
  return kind === 'structural' ? structural : tension;
}

export function majorSecondPenalty(
  lowPitch: number,
  highPitch: number,
  octaveShift: number,
): number {
  return minorSecondPenalty(lowPitch, highPitch, 'structural', octaveShift) * 0.22;
}

export function clusterDensityPenalty(rightPitches: readonly number[]): number {
  if (rightPitches.length < VOICING_POLICY.CLUSTER_DENSITY_MIN_NOTES) return 0;
  const span = rightPitches[rightPitches.length - 1]! - rightPitches[0]!;
  if (span <= VOICING_POLICY.CLUSTER_DENSITY_SPAN) return 18;
  if (span <= VOICING_POLICY.CLUSTER_DENSITY_SPAN + 2) return 8;
  return 0;
}

export function bassRootDuplicationPenalty(
  notes: readonly BaseVoicingNote[],
  uniqueToneCount: number,
): number {
  const bass = notes.find((note) => note.hand === 'LH');
  if (!bass || intervalRole(bass.interval) !== 'root') return 0;
  const duplicated = notes.some(
    (note) => note.hand === 'RH' && wrapPc(note.pc) === wrapPc(bass.pc),
  );
  if (!duplicated) return 0;
  return uniqueToneCount >= 5 ? 11 : 2;
}

export function tensionRegisterPenalty(note: BaseVoicingNote, octaveShift: number): number {
  const role = intervalRole(note.interval);
  if (!isTensionRole(role)) return 0;
  const floor = (role === 'alteredTension' ? 58 : 53) + octaveShift * 12;
  if (note.pitch >= floor) return 0;
  const weight = role === 'alteredTension' ? 2.4 : 1.5;
  return (floor - note.pitch) * weight;
}

function pairKind(low: BaseVoicingNote, high: BaseVoicingNote): DissonanceKind {
  return isTensionRole(intervalRole(low.interval)) || isTensionRole(intervalRole(high.interval))
    ? 'tension'
    : 'structural';
}

export function hasExtremeLowMinorSecond(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
): boolean {
  const ceiling = LOW_CLUSTER_HARD_CEILING + preference.octaveShift * 12;
  const right = rightHand(notes);
  for (let index = 0; index < right.length - 1; index += 1) {
    const low = right[index]!;
    const high = right[index + 1]!;
    if (high.pitch - low.pitch === 1 && low.pitch < ceiling) return true;
  }
  return false;
}

function availableRoles(intervals: readonly number[]): Set<IntervalRole> {
  return new Set(intervals.map(intervalRole));
}

function soundingRoles(notes: readonly BaseVoicingNote[]): Set<IntervalRole> {
  return new Set(notes.map((note) => intervalRole(note.interval)));
}

function missingRoleCost(notes: readonly BaseVoicingNote[], context: VoicingPolicyContext): number {
  const available = availableRoles(context.availableIntervals);
  const sounding = soundingRoles(notes);
  let cost = 0;
  if (available.has('third') && !sounding.has('third')) cost += VOICING_POLICY.GUIDE_TONE_ABSENCE;
  if (available.has('seventh') && !sounding.has('seventh'))
    cost += VOICING_POLICY.GUIDE_TONE_ABSENCE;
  if (available.has('alteredFifth') && !sounding.has('alteredFifth')) {
    cost += VOICING_POLICY.GUIDE_TONE_ABSENCE;
  }
  if (available.has('alteredTension') && !sounding.has('alteredTension')) {
    cost += VOICING_POLICY.TENSION_ABSENCE;
  }
  if (available.has('naturalTension') && !sounding.has('naturalTension')) {
    cost += VOICING_POLICY.TENSION_ABSENCE;
  }
  if (available.has('root') && !sounding.has('root')) cost += VOICING_POLICY.ROOT_ABSENCE;
  if (available.has('fifth') && !sounding.has('fifth'))
    cost += VOICING_POLICY.PERFECT_FIFTH_ABSENCE;
  return cost;
}

function inversionAnchorCost(
  notes: readonly BaseVoicingNote[],
  context: VoicingPolicyContext,
): number {
  if (context.preferredRightAnchorPc == null) return 0;
  const lowest = rightHand(notes)[0];
  if (!lowest) return 0;
  return wrapPc(lowest.pc) === wrapPc(context.preferredRightAnchorPc)
    ? 0
    : VOICING_POLICY.INVERSION_ANCHOR_PENALTY;
}

export function evaluateVoicingPolicy(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
  context: VoicingPolicyContext,
): VoicingPolicyBreakdown {
  if (hasExtremeLowMinorSecond(notes, preference)) {
    return {
      hardReject: true,
      spacingCost: 0,
      dissonanceCost: 0,
      harmonicRoleCost: 0,
      duplicationCost: 0,
      inversionAnchorCost: 0,
      totalSoftCost: Number.POSITIVE_INFINITY,
    };
  }

  const right = rightHand(notes);
  const uniqueToneCount = new Set(context.availableIntervals.map((interval) => wrapPc(interval)))
    .size;
  let dissonanceCost = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const low = right[index]!;
    const high = right[index + 1]!;
    const width = high.pitch - low.pitch;
    if (width === 1) {
      dissonanceCost += minorSecondPenalty(
        low.pitch,
        high.pitch,
        pairKind(low, high),
        preference.octaveShift,
      );
    } else if (width === 2) {
      dissonanceCost += majorSecondPenalty(low.pitch, high.pitch, preference.octaveShift);
    }
  }

  const spacingCost = clusterDensityPenalty(right.map((note) => note.pitch));
  const targetRhCount = Math.min(4, uniqueToneCount);
  const thinnessCost =
    uniqueToneCount <= 4 && right.length < targetRhCount ? (targetRhCount - right.length) * 3 : 0;
  const duplicationCost = bassRootDuplicationPenalty(notes, uniqueToneCount);
  const roleCost =
    missingRoleCost(notes, context) +
    notes.reduce((sum, note) => sum + tensionRegisterPenalty(note, preference.octaveShift), 0);
  const anchorCost = inversionAnchorCost(notes, context);

  const breakdown: VoicingPolicyBreakdown = {
    hardReject: false,
    spacingCost: spacingCost + thinnessCost,
    dissonanceCost,
    harmonicRoleCost: roleCost,
    duplicationCost,
    inversionAnchorCost: anchorCost,
    totalSoftCost: 0,
  };
  breakdown.totalSoftCost =
    breakdown.spacingCost +
    breakdown.dissonanceCost +
    breakdown.harmonicRoleCost +
    breakdown.duplicationCost +
    breakdown.inversionAnchorCost;
  return breakdown;
}

export function supportToneSpecs<T extends { interval: number }>(specs: readonly T[]): T[] {
  return specs.filter((spec) => {
    const role = intervalRole(spec.interval);
    return role === 'root' || role === 'fifth';
  });
}
