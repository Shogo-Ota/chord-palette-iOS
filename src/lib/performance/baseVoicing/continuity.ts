/**
 * Voice movement between two consecutive Base Voicings.
 *
 * Policy-neutral: it measures how far the hands travel and how much they hold in
 * common. How much that movement matters relative to static quality, and how the
 * progression-wide path is searched, belong to the policy (`policy/pathSearch`).
 */

import type { BaseVoicingNote } from './types';

export function orderedVoicingPitches(
  notes: readonly BaseVoicingNote[],
  hand?: BaseVoicingNote['hand'],
): number[] {
  return notes
    .filter((note) => hand == null || note.hand === hand)
    .map((note) => note.pitch)
    .sort((left, right) => left - right);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pairedMovement(previous: readonly number[], next: readonly number[]): number {
  const count = Math.min(previous.length, next.length);
  let movement = Math.abs(previous.length - next.length) * 6;
  for (let index = 0; index < count; index += 1) {
    movement += Math.abs(previous[index]! - next[index]!);
  }
  return movement;
}

export function baseVoicingTransitionCost(
  previous: readonly BaseVoicingNote[],
  next: readonly BaseVoicingNote[],
): number {
  const previousAll = orderedVoicingPitches(previous);
  const nextAll = orderedVoicingPitches(next);
  const previousRight = orderedVoicingPitches(previous, 'RH');
  const nextRight = orderedVoicingPitches(next, 'RH');
  const previousBass = orderedVoicingPitches(previous, 'LH')[0]!;
  const nextBass = orderedVoicingPitches(next, 'LH')[0]!;
  const previousTop = previousRight[previousRight.length - 1]!;
  const nextTop = nextRight[nextRight.length - 1]!;
  const previousSpan = previousTop - previousBass;
  const nextSpan = nextTop - nextBass;
  const commonMidi = nextAll.filter((pitch) => previousAll.includes(pitch)).length;
  const commonPc = nextAll.filter((pitch) =>
    previousAll.some((candidate) => candidate % 12 === pitch % 12),
  ).length;

  let cost = pairedMovement(previousRight, nextRight) * 1.1;
  cost += Math.abs(nextBass - previousBass) * 0.65;
  cost += Math.abs(nextTop - previousTop) * 1.1;
  cost += Math.abs(mean(nextRight) - mean(previousRight)) * 0.8;
  cost += Math.abs(nextSpan - previousSpan) * 0.35;
  cost -= commonMidi * 4;
  cost -= commonPc * 0.75;
  if (Math.abs(nextBass - previousBass) >= 12) cost += 24;
  if (Math.abs(nextTop - previousTop) >= 12) cost += 30;
  return cost;
}
