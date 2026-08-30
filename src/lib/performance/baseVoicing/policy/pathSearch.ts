/**
 * Progression-wide candidate selection.
 *
 * Both strategies are global (never chord-by-chord greedy) and both include the
 * closing transition, so a looped four-bar progression cannot hide an octave
 * jump at its repeat point. They differ only in how much of the lattice they
 * keep alive, which is a musical trade-off: the exhaustive pass can prefer a
 * different opening voicing to make the loop close better.
 */

import { orderedVoicingPitches } from '../continuity';
import type { BaseVoicingCandidate } from '../types';
import type { VoicingPathSearch, VoicingPolicySpec } from './types';

const EPSILON = 1e-9;

function candidateKey(candidate: BaseVoicingCandidate): string {
  return orderedVoicingPitches(candidate.notes).join(',');
}

type PathState = {
  cost: number;
  path: number[];
  key: string;
};

/**
 * Approved strategy: restart the lattice from every first-chord candidate and
 * compare fully closed loops. Exact, and quadratic in the first layer.
 */
export const searchPathPerStart: VoicingPathSearch = (layers, options) => {
  if (layers.length === 0) return [];
  if (layers.some((layer) => layer.length === 0)) return [];

  const { transitionCost, continuityWeight } = options;
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
          const transition = transitionCost(previousLayer[previousIndex]!.notes, candidate.notes);
          const key = `${state.key}|${candidateKey(candidate)}`;
          const next: PathState = {
            cost: state.cost + candidate.staticCost + continuityWeight * transition,
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
          ? continuityWeight * transitionCost(finalLayer[finalIndex]!.notes, first.notes)
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
};

type TrackedPathState = PathState & { firstIndex: number };

/**
 * One forward pass that carries each surviving path's start index, so loop
 * closure stays exact without rerunning the lattice from every opening. Cheaper
 * than the per-start pass and it scales to longer progressions; it can settle on
 * a different opening voicing because a path is pruned per chord rather than per
 * start.
 */
export const searchPathForwardTracked: VoicingPathSearch = (layers, options) => {
  if (layers.length === 0) return [];
  if (layers.some((layer) => layer.length === 0)) return [];

  const { transitionCost, continuityWeight } = options;
  const firstLayer = layers[0]!;
  let states: TrackedPathState[] = firstLayer.map((first, firstIndex) => ({
    cost: first.staticCost,
    path: [firstIndex],
    key: candidateKey(first),
    firstIndex,
  }));

  for (let layerIndex = 1; layerIndex < layers.length; layerIndex += 1) {
    const previousLayer = layers[layerIndex - 1]!;
    const layer = layers[layerIndex]!;
    states = layer.map((candidate, candidateIndex) => {
      let chosen: TrackedPathState | undefined;
      states.forEach((state, previousIndex) => {
        if (!Number.isFinite(state.cost)) return;
        const transition = transitionCost(previousLayer[previousIndex]!.notes, candidate.notes);
        const key = `${state.key}|${candidateKey(candidate)}`;
        const next: TrackedPathState = {
          cost: state.cost + candidate.staticCost + continuityWeight * transition,
          path: [...state.path, candidateIndex],
          key,
          firstIndex: state.firstIndex,
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
          firstIndex: 0,
        }
      );
    });
  }

  const finalLayer = layers[layers.length - 1]!;
  let best: TrackedPathState | undefined;
  states.forEach((state, finalIndex) => {
    if (!Number.isFinite(state.cost)) return;
    const closedCost =
      state.cost +
      (layers.length > 1
        ? continuityWeight *
          transitionCost(finalLayer[finalIndex]!.notes, firstLayer[state.firstIndex]!.notes)
        : 0);
    const closed: TrackedPathState = { ...state, cost: closedCost };
    if (
      best == null ||
      closed.cost < best.cost - EPSILON ||
      (Math.abs(closed.cost - best.cost) <= EPSILON && closed.key < best.key)
    ) {
      best = closed;
    }
  });

  if (best == null) return [];
  return best.path.map((candidateIndex, layerIndex) => layers[layerIndex]![candidateIndex]!);
};

/** Run a policy's own search with its own movement weight. */
export function selectVoicingPath(
  layers: readonly (readonly BaseVoicingCandidate[])[],
  policy: VoicingPolicySpec,
): BaseVoicingCandidate[] {
  return policy.searchPath(layers, {
    transitionCost: policy.transitionCost,
    continuityWeight: policy.continuityWeight,
  });
}
