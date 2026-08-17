import type { BaseVoicingCandidate, BaseVoicingNote } from './types';

const EPSILON = 1e-9;

function orderedPitches(
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
  const previousAll = orderedPitches(previous);
  const nextAll = orderedPitches(next);
  const previousRight = orderedPitches(previous, 'RH');
  const nextRight = orderedPitches(next, 'RH');
  const previousBass = orderedPitches(previous, 'LH')[0]!;
  const nextBass = orderedPitches(next, 'LH')[0]!;
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

function candidateKey(candidate: BaseVoicingCandidate): string {
  return orderedPitches(candidate.notes).join(',');
}

type PathState = {
  cost: number;
  path: number[];
  key: string;
};

/**
 * Global dynamic-programming selection. The closing transition is included so a
 * looped four-bar progression does not hide an octave jump at its repeat point.
 */
export function selectContinuousCandidatePath(
  layers: readonly (readonly BaseVoicingCandidate[])[],
): BaseVoicingCandidate[] {
  if (layers.length === 0) return [];
  if (layers.some((layer) => layer.length === 0)) return [];

  let best: PathState | undefined;
  const firstLayer = layers[0]!;

  firstLayer.forEach((first, firstIndex) => {
    let states: PathState[] = firstLayer.map((_, index) => ({
      cost: index === firstIndex ? first.staticCost : Number.POSITIVE_INFINITY,
      path: index === firstIndex ? [index] : [],
      key: index === firstIndex ? candidateKey(first) : '',
    }));

    for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
      const previousLayer = layers[layerIndex - 1]!;
      const layer = layers[layerIndex]!;
      states = layer.map((candidate, candidateIndex) => {
        let chosen: PathState | undefined;
        states.forEach((state, previousIndex) => {
          if (!Number.isFinite(state.cost)) return;
          const transition = baseVoicingTransitionCost(
            previousLayer[previousIndex]!.notes,
            candidate.notes,
          );
          const key = `${state.key}|${candidateKey(candidate)}`;
          const next: PathState = {
            cost: state.cost + candidate.staticCost + transition,
            path: [...state.path, candidateIndex],
            key,
          };
          if (
            chosen == null ||
            next.cost < chosen.cost - EPSILON ||
            (Math.abs(next.cost - chosen.cost) <= EPSILON && next.key < chosen.key)
          ) {
            chosen = next;
          }
        });
        return (
          chosen ?? {
            cost: Number.POSITIVE_INFINITY,
            path: [],
            key: '',
          }
        );
      });
    }

    const finalLayer = layers[layers.length - 1]!;
    states.forEach((state, finalIndex) => {
      if (!Number.isFinite(state.cost)) return;
      const closedCost =
        state.cost +
        (layers.length > 1
          ? baseVoicingTransitionCost(finalLayer[finalIndex]!.notes, first.notes)
          : 0);
      const closed: PathState = { ...state, cost: closedCost };
      if (
        best == null ||
        closed.cost < best.cost - EPSILON ||
        (Math.abs(closed.cost - best.cost) <= EPSILON && closed.key < best.key)
      ) {
        best = closed;
      }
    });
  });

  if (best == null) return [];
  return best.path.map((candidateIndex, layerIndex) => layers[layerIndex]![candidateIndex]!);
}
