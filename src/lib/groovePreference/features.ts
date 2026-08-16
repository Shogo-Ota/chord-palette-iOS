import type {
  DistributionSummary,
  GrooveControlChange,
  GrooveFeatureVector,
  GrooveNote,
} from './types';

type AttackGroup = {
  startBeat: number;
  notes: GrooveNote[];
  velocity: number;
};

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function std(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const center = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - center) ** 2)));
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function summarize(values: readonly number[]): DistributionSummary {
  return {
    values: [...values],
    mean: mean(values),
    std: std(values),
    median: percentile(values, 0.5),
    p10: percentile(values, 0.1),
    p90: percentile(values, 0.9),
  };
}

function groupsFromNotes(notes: readonly GrooveNote[]): AttackGroup[] {
  const byAttack = new Map<string, GrooveNote[]>();
  for (const note of notes) {
    const list = byAttack.get(note.sourceAttackId) ?? [];
    list.push(note);
    byAttack.set(note.sourceAttackId, list);
  }
  return [...byAttack.values()]
    .map((group) => ({
      startBeat: group[0].startBeat,
      notes: group,
      velocity: mean(group.map((note) => note.velocity)),
    }))
    .sort((a, b) => a.startBeat - b.startBeat);
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const sx = std(x);
  const sy = std(y);
  if (sx < 1e-9 || sy < 1e-9) return 0;
  const mx = mean(x);
  const my = mean(y);
  return mean(x.map((value, i) => (value - mx) * (y[i] - my))) / (sx * sy);
}

function beatInBar(beat: number, beatsPerBar: number): number {
  return ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
}

function nearestGridDeviation(beat: number, grid = 0.5): number {
  return beat - Math.round(beat / grid) * grid;
}

function pedalCoverage(changes: readonly GrooveControlChange[], totalBeats: number): number {
  let downAt: number | null = null;
  let covered = 0;
  for (const cc of [...changes].sort((a, b) => a.startBeat - b.startBeat || a.value - b.value)) {
    const at = Math.max(0, Math.min(totalBeats, cc.startBeat));
    if (cc.value >= 64 && downAt == null) downAt = at;
    if (cc.value < 64 && downAt != null) {
      covered += Math.max(0, at - downAt);
      downAt = null;
    }
  }
  if (downAt != null) covered += totalBeats - downAt;
  return totalBeats ? covered / totalBeats : 0;
}

function phraseVector(groups: readonly AttackGroup[], startBeat: number): number[] {
  const slots = Array.from({ length: 64 }, () => 0);
  for (const group of groups) {
    const relative = group.startBeat - startBeat;
    if (relative < -1e-6 || relative >= 16 - 1e-6) continue;
    const slot = Math.max(0, Math.min(63, Math.round(relative * 4)));
    slots[slot] = Math.max(slots[slot], group.velocity / 127);
  }
  return slots;
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const dot = a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
  const ma = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const mb = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (ma < 1e-9 && mb < 1e-9) return 1;
  if (ma < 1e-9 || mb < 1e-9) return 0;
  return Math.max(0, Math.min(1, dot / (ma * mb)));
}

export function extractGrooveFeatures(
  notes: readonly GrooveNote[],
  controlChanges: readonly GrooveControlChange[],
  totalBeats = 32,
  beatsPerBar = 4,
): GrooveFeatureVector {
  const groups = groupsFromNotes(notes);
  const starts = groups.map((group) => group.startBeat);
  const iois = starts.slice(1).map((start, i) => start - starts[i]);
  const gridPattern = starts.map((start) => nearestGridDeviation(start));
  const velocities = notes.map((note) => note.velocity);
  const velocityContour = groups.map((group) => group.velocity);

  const beatHistogram = Array.from({ length: 16 }, () => 0);
  for (const group of groups) {
    const slot = Math.max(
      0,
      Math.min(15, Math.round(beatInBar(group.startBeat, beatsPerBar) * 4) % 16),
    );
    beatHistogram[slot] += 1;
  }
  if (groups.length) {
    for (let i = 0; i < beatHistogram.length; i += 1) beatHistogram[i] /= groups.length;
  }

  const occupiedSlots = new Set(
    groups.map((group) =>
      Math.max(0, Math.min(totalBeats * 4 - 1, Math.round(group.startBeat * 4))),
    ),
  );
  const offBeat = groups.filter(
    (group) => Math.abs(group.startBeat - Math.round(group.startBeat)) > 1e-6,
  ).length;
  const syncopated = groups.filter((group) => {
    const inBar = beatInBar(group.startBeat, beatsPerBar);
    const eighthIndex = Math.round(inBar * 2);
    return eighthIndex % 2 === 1 || Math.abs(inBar * 2 - eighthIndex) > 1e-6;
  }).length;

  const accentThreshold = percentile(velocityContour, 0.75);
  const accentPositions = groups
    .filter((group) => group.velocity >= accentThreshold)
    .map((group) => beatInBar(group.startBeat, beatsPerBar));
  const timingStrength = groups.map((group) => {
    const distanceToBeat = Math.abs(group.startBeat - Math.round(group.startBeat));
    return 1 - Math.min(1, distanceToBeat * 2);
  });

  const articulation = notes.map((note) => {
    const next = starts.find((start) => start > note.startBeat + 1e-9);
    const available = next == null ? totalBeats - note.startBeat : next - note.startBeat;
    return available > 0 ? note.durationBeat / available : 0;
  });

  const firstPhrase = phraseVector(groups, 0);
  const secondPhrase = phraseVector(groups, 16);
  const phraseRepetitionSimilarity = cosineSimilarity(firstPhrase, secondPhrase);

  return {
    attackGroupsPerBar: groups.length / Math.max(1, totalBeats / beatsPerBar),
    attackDensity: groups.length / Math.max(1, totalBeats),
    restRatio: 1 - occupiedSlots.size / Math.max(1, totalBeats * 4),
    beatPositionHistogram: beatHistogram,
    offBeatRatio: groups.length ? offBeat / groups.length : 0,
    syncopation: groups.length ? syncopated / groups.length : 0,
    ioiDistribution: summarize(iois),
    ioiVariation: mean(iois) > 1e-9 ? std(iois) / mean(iois) : 0,
    gridDeviationMean: mean(gridPattern.map(Math.abs)),
    gridDeviationStd: std(gridPattern),
    gridDeviationPattern: gridPattern,
    velocityMean: mean(velocities),
    velocityStd: std(velocities),
    velocityRange: velocities.length ? Math.max(...velocities) - Math.min(...velocities) : 0,
    velocityContour,
    accentPositions,
    timingVelocityCorrelation: pearson(timingStrength, velocityContour),
    durationMedian: percentile(
      notes.map((note) => note.durationBeat),
      0.5,
    ),
    articulationRatio: percentile(articulation, 0.5),
    cc64Coverage: pedalCoverage(controlChanges, totalBeats),
    phraseRepetitionSimilarity,
    phraseVariationAmount: 1 - phraseRepetitionSimilarity,
  };
}
