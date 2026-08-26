/**
 * `compact.v2` cost model: pure interval, register and role evaluation.
 *
 * No chord-symbol branches, no style input, no teacher MIDI. Hard rejects stay
 * rare and spacing/dissonance are soft costs, so a legal tension (♭9, maj7, …)
 * is never deleted to "fix" muddiness — only moved or spread. Missing chord
 * tones are priced far above any cluster, which is what makes moving cheaper
 * than deleting.
 */

import { wrapPc } from '../../humanTemplate/degreeRoles';
import type { BaseVoicingNote, BaseVoicingPreference } from '../types';
import {
  intervalRole,
  isTensionRole,
  topNaturalTension,
  uniqueAvailableTones,
} from './intervalRoles';
import type { VoicingCostContext } from './types';

/**
 * Extreme low-register minor seconds (below E3 at octaveShift 0) are rejected.
 * Aligns with compact RH.lo = 48: the bottom of the right-hand window may
 * legally hold a tone, but not a cluster.
 */
export const LOW_CLUSTER_HARD_CEILING = 52;

export const V2_COST_WEIGHTS = {
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
  /** A lower extension may yield once the identity extension is present. */
  SECONDARY_TENSION_ABSENCE: 24,
  ROOT_ABSENCE: 28,
  PERFECT_FIFTH_ABSENCE: 1.5,
} as const;

export type DissonanceKind = 'structural' | 'tension';

export type VoicingCostBreakdown = {
  hardReject: boolean;
  spacingCost: number;
  dissonanceCost: number;
  requiredToneCost: number;
  tensionRegisterCost: number;
  duplicationCost: number;
  inversionAnchorCost: number;
  totalSoftCost: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rightHand(notes: readonly BaseVoicingNote[]): BaseVoicingNote[] {
  return notes.filter((note) => note.hand === 'RH').sort((left, right) => left.pitch - right.pitch);
}

function registerT(pitch: number, octaveShift: number): number {
  const lo = V2_COST_WEIGHTS.RH_REGISTER_LO + octaveShift * 12;
  const hi = V2_COST_WEIGHTS.RH_REGISTER_HI + octaveShift * 12;
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
  if (rightPitches.length < V2_COST_WEIGHTS.CLUSTER_DENSITY_MIN_NOTES) return 0;
  const span = rightPitches[rightPitches.length - 1]! - rightPitches[0]!;
  if (span <= V2_COST_WEIGHTS.CLUSTER_DENSITY_SPAN) return 18;
  if (span <= V2_COST_WEIGHTS.CLUSTER_DENSITY_SPAN + 2) return 8;
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

/**
 * What omitting one available chord tone costs. Guide tones and the identity
 * extension are effectively mandatory; a plain fifth is nearly free.
 */
export function toneAbsenceCost(interval: number, identityTension: number | null): number {
  const role = intervalRole(interval);
  if (role === 'third' || role === 'seventh' || role === 'alteredFifth') {
    return V2_COST_WEIGHTS.GUIDE_TONE_ABSENCE;
  }
  if (role === 'alteredTension') return V2_COST_WEIGHTS.TENSION_ABSENCE;
  if (role === 'naturalTension') {
    return interval === identityTension
      ? V2_COST_WEIGHTS.TENSION_ABSENCE
      : V2_COST_WEIGHTS.SECONDARY_TENSION_ABSENCE;
  }
  if (role === 'root') return V2_COST_WEIGHTS.ROOT_ABSENCE;
  return V2_COST_WEIGHTS.PERFECT_FIFTH_ABSENCE;
}

/**
 * Priced interval by interval, not role by role: a role-set check cannot see
 * that a 13th chord lost its 13th while it still holds a 9th, so every
 * available tone is checked on its own.
 */
export function requiredToneCost(
  notes: readonly BaseVoicingNote[],
  context: VoicingCostContext,
): number {
  const tones = uniqueAvailableTones(context.availableIntervals);
  const identityTension = topNaturalTension(tones);
  const sounding = new Set(notes.map((note) => wrapPc(note.pc)));
  let cost = 0;
  for (const interval of tones) {
    if (sounding.has(wrapPc(context.rootPc + interval))) continue;
    cost += toneAbsenceCost(interval, identityTension);
  }
  return cost;
}

function inversionAnchorCost(
  notes: readonly BaseVoicingNote[],
  context: VoicingCostContext,
): number {
  if (context.preferredRightAnchorPc == null) return 0;
  const lowest = rightHand(notes)[0];
  if (!lowest) return 0;
  return wrapPc(lowest.pc) === wrapPc(context.preferredRightAnchorPc)
    ? 0
    : V2_COST_WEIGHTS.INVERSION_ANCHOR_PENALTY;
}

export function evaluateCompactV2Cost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
  context: VoicingCostContext,
): VoicingCostBreakdown {
  if (hasExtremeLowMinorSecond(notes, preference)) {
    return {
      hardReject: true,
      spacingCost: 0,
      dissonanceCost: 0,
      requiredToneCost: 0,
      tensionRegisterCost: 0,
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

  const breakdown: VoicingCostBreakdown = {
    hardReject: false,
    spacingCost: spacingCost + thinnessCost,
    dissonanceCost,
    requiredToneCost: requiredToneCost(notes, context),
    tensionRegisterCost: notes.reduce(
      (sum, note) => sum + tensionRegisterPenalty(note, preference.octaveShift),
      0,
    ),
    duplicationCost: bassRootDuplicationPenalty(notes, uniqueToneCount),
    inversionAnchorCost: inversionAnchorCost(notes, context),
    totalSoftCost: 0,
  };
  breakdown.totalSoftCost =
    breakdown.spacingCost +
    breakdown.dissonanceCost +
    breakdown.requiredToneCost +
    breakdown.tensionRegisterCost +
    breakdown.duplicationCost +
    breakdown.inversionAnchorCost;
  return breakdown;
}
