/**
 * `compact.v3` cost model: the collision contract as a rejection rule.
 *
 * The rules are not restated here. `evaluateIntervalPair` is the same function the
 * HarmonyCollisionValidator runs over generated output, so a voicing this policy
 * accepts is a voicing that validator passes — there is one definition of a
 * collision, called from two places.
 *
 * Correction happens by candidate selection, not by rewriting notes. The engine
 * already enumerates every octave placement of every tone, so raising the upper
 * voice, lowering the bass and omitting an optional tone all exist as siblings of
 * the rejected candidate. Pitch class is never changed to escape a collision.
 *
 * The rejection is priced as a large finite number rather than infinity. A chord
 * that cannot be voiced cleanly inside the compact hand then yields its least-bad
 * voicing instead of failing generation, which is what the contract's "reject and
 * regenerate" step has to mean for a deterministic engine.
 */

import {
  PIANO_COLLISION_PROFILE,
  evaluateIntervalPair,
  shiftProfile,
  type HarmonyCollisionChord,
} from '../../harmonyCollision';
import { collisionChordFromIntervals } from '../../harmonyCollision/chordContext';
import type { BaseVoicingNote, BaseVoicingPreference } from '../types';
import { V2_COST_WEIGHTS, softCostBreakdown, type VoicingCostBreakdown } from './compactV2Costs';
import type { VoicingCostContext } from './types';

/**
 * Far above any soft cost, so a clean voicing always outranks a colliding one, and
 * above the largest continuity cost a transition can add, so voice leading can never
 * buy a collision.
 */
export const COLLISION_REJECT_COST = 100_000;

export const V3_COST_WEIGHTS = {
  ...V2_COST_WEIGHTS,
  COLLISION_REJECT_COST,
} as const;

export type CollisionRejection = {
  readonly lowerNote: number;
  readonly upperNote: number;
  readonly ruleId: string;
  readonly reason: string;
};

/** Every pair of the candidate the collision contract would reject. */
export function collisionRejections(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
  chord: HarmonyCollisionChord,
): CollisionRejection[] {
  const profile = shiftProfile(PIANO_COLLISION_PROFILE, preference.octaveShift);
  const pitches = notes.map((note) => note.pitch).sort((left, right) => left - right);
  const rejections: CollisionRejection[] = [];
  // A Shared Base voicing sounds as one attack, so every pair overlaps.
  for (let low = 0; low < pitches.length - 1; low += 1) {
    for (let high = low + 1; high < pitches.length; high += 1) {
      const verdict = evaluateIntervalPair(pitches[low]!, pitches[high]!, chord, profile);
      if (!verdict || verdict.result !== 'REJECT') continue;
      rejections.push({
        lowerNote: pitches[low]!,
        upperNote: pitches[high]!,
        ruleId: verdict.ruleId,
        reason: verdict.reason,
      });
    }
  }
  return rejections;
}

export type CompactV3Breakdown = VoicingCostBreakdown & {
  collisionCost: number;
  rejections: readonly CollisionRejection[];
};

export function evaluateCompactV3Cost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
  context: VoicingCostContext,
): CompactV3Breakdown {
  const chord = collisionChordFromIntervals(context.rootPc, context.availableIntervals);
  const rejections = collisionRejections(notes, preference, chord);
  const soft = softCostBreakdown(notes, preference, context);
  const collisionCost = rejections.length * COLLISION_REJECT_COST;
  return {
    ...soft,
    hardReject: rejections.length > 0,
    collisionCost,
    rejections,
    totalSoftCost: soft.totalSoftCost + collisionCost,
  };
}
