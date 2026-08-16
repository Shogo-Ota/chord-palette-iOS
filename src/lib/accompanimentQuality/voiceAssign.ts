/**
 * Minimum-cost voice assignment of maximum cardinality.
 * Voices are matched by pitch proximity, not by sort-index.
 * All voices on the smaller side are paired; extras on the larger side stay unmatched.
 */

export type VoicePair = { fromIndex: number; toIndex: number; from: number; to: number; cost: number };

export type VoiceAssignment = {
  pairs: VoicePair[];
  unmatchedFrom: number[];
  unmatchedTo: number[];
  totalCost: number;
  crossingCount: number;
};

function countCrossings(pairs: VoicePair[]): number {
  let n = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const a = pairs[i];
      const b = pairs[j];
      if ((a.from - b.from) * (a.to - b.to) < 0) n += 1;
    }
  }
  return n;
}

function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of permute(items.filter((_, j) => j !== i))) out.push([item, ...rest]);
  });
  return out;
}

/**
 * Assign every pitch on the smaller side to a unique pitch on the larger side
 * so total |Δsemitone| is minimized.
 */
export function assignVoices(from: readonly number[], to: readonly number[]): VoiceAssignment {
  if (from.length === 0 || to.length === 0) {
    return {
      pairs: [],
      unmatchedFrom: [...from],
      unmatchedTo: [...to],
      totalCost: 0,
      crossingCount: 0,
    };
  }

  const swap = from.length > to.length;
  const small = swap ? to : from;
  const large = swap ? from : to;
  const smallIsFrom = !swap;

  let bestCost = Infinity;
  let bestPairs: VoicePair[] = [];
  const largeIdx = large.map((_, i) => i);
  for (const order of permute(largeIdx)) {
    const chosen = order.slice(0, small.length);
    const pairs: VoicePair[] = [];
    let cost = 0;
    for (let i = 0; i < small.length; i += 1) {
      const s = small[i];
      const l = large[chosen[i]];
      const c = Math.abs(s - l);
      cost += c;
      pairs.push(
        smallIsFrom
          ? { fromIndex: i, toIndex: chosen[i], from: s, to: l, cost: c }
          : { fromIndex: chosen[i], toIndex: i, from: l, to: s, cost: c },
      );
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestPairs = pairs;
    }
  }

  const usedFrom = new Set(bestPairs.map((p) => p.fromIndex));
  const usedTo = new Set(bestPairs.map((p) => p.toIndex));
  return {
    pairs: bestPairs,
    unmatchedFrom: from.filter((_, i) => !usedFrom.has(i)),
    unmatchedTo: to.filter((_, j) => !usedTo.has(j)),
    totalCost: bestPairs.reduce((s, p) => s + p.cost, 0),
    crossingCount: countCrossings(bestPairs),
  };
}
