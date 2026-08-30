/**
 * Where the hands sit, independent of harmony.
 *
 * Shared by every policy so "compact two-hand piano" means the same register in
 * all of them. Musical opinions about spacing and dissonance live in the policy
 * cost models, not here.
 */

import { compactRegisterPolicy } from '../handModel';
import type { BaseVoicingNote, BaseVoicingPreference } from '../types';

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Distance from the neutral compact shape: bass near the left-hand center, right
 * hand centered in its window, and a hand span that neither collapses nor
 * stretches. Term order is part of the approved baseline arithmetic.
 */
export function registerPlacementCost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
): number {
  const policy = compactRegisterPolicy(preference);
  const left = notes.filter((note) => note.hand === 'LH');
  const right = notes.filter((note) => note.hand === 'RH').sort((a, b) => a.pitch - b.pitch);
  const bass = left[0]!.pitch;
  const rightPitches = right.map((note) => note.pitch);
  const rightLow = rightPitches[0]!;
  const top = rightPitches[rightPitches.length - 1]!;
  const rightSpan = top - rightLow;
  const totalSpan = top - bass;
  const targetRightSpan = right.length <= 3 ? 9 : 11;
  const targetTotalSpan = right.length <= 3 ? 20 : 24;

  let cost = Math.abs(bass - policy.lh.center) * 0.8;
  cost += Math.abs(mean(rightPitches) - policy.rh.center) * 0.65;
  cost += Math.abs(rightSpan - targetRightSpan) * 0.35;
  cost += Math.abs(totalSpan - targetTotalSpan) * 0.25;
  return cost;
}
