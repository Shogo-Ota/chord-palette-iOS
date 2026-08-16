import type { FinalMidiSnapshot } from '../finalMidi/types';
import type { PerfChord } from '../PerformanceEngine';
import type { AtomicGrooveAttack, FullVoicing, NaturalVoicingMask } from './types';

type Group = {
  onset: number;
  pitches: number[];
  durations: number[];
  velocities: number[];
};

export type NaturalAtomicMetrics = {
  noteCount: number;
  attackGroupCount: number;
  meanNotesPerAttack: number;
  pitchMin: number;
  pitchMax: number;
  velocityMean: number;
  velocityStdDev: number;
  durationMean: number;
  attackVelocityCentroidMean: number;
  attackVelocityCentroidStdDev: number;
  attackDurationMedianMean: number;
  positiveGapMean: number;
  restRatio: number;
  meanChordTransitionMovement: number;
  maxChordTransitionBassJump: number;
  maxChordTransitionTopJump: number;
  maxChordTransitionCenterJump: number;
  representativeBassMean: number;
  representativeTopMean: number;
  representativeCenterMean: number;
  maskCounts?: Partial<Record<NaturalVoicingMask, number>>;
  handRole?: {
    leftMin: number;
    leftMax: number;
    rightMin: number;
    rightMax: number;
    meanLeftMovement: number;
    meanRightCenterMovement: number;
    colorInLeftCount: number;
  };
};

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: readonly number[]): number {
  const center = mean(values);
  return values.length ? Math.sqrt(mean(values.map((value) => (value - center) ** 2))) : 0;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function groupsFor(snapshot: FinalMidiSnapshot): Group[] {
  const notes = snapshot.notes
    .filter((note) => note.track === 'accompaniment')
    .sort((left, right) => left.startBeat - right.startBeat || left.pitch - right.pitch);
  const groups: Group[] = [];
  for (const note of notes) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.onset - note.startBeat) <= 1 / 32) {
      last.pitches.push(note.pitch);
      last.durations.push(note.durationBeat);
      last.velocities.push(note.velocity);
    } else {
      groups.push({
        onset: note.startBeat,
        pitches: [note.pitch],
        durations: [note.durationBeat],
        velocities: [note.velocity],
      });
    }
  }
  return groups;
}

function movement(left: Group, right: Group): number {
  const a = [...left.pitches].sort((x, y) => x - y);
  const b = [...right.pitches].sort((x, y) => x - y);
  const count = Math.min(a.length, b.length);
  if (count === 0) return 0;
  let total = Math.abs(a.length - b.length) * 4;
  for (let index = 0; index < count; index++) total += Math.abs(a[index]! - b[index]!);
  return total / Math.max(a.length, b.length);
}

function representativeGroups(groups: readonly Group[], chords: readonly PerfChord[]): Group[] {
  return chords
    .map(
      (chord) =>
        groups
          .filter(
            (group) =>
              group.onset >= chord.startBeat - 1e-9 &&
              group.onset < chord.startBeat + chord.durationBeats - 1e-9,
          )
          .sort(
            (left, right) => right.pitches.length - left.pitches.length || left.onset - right.onset,
          )[0],
    )
    .filter((group): group is Group => group !== undefined);
}

export function analyzeNaturalAtomicMetrics(
  snapshot: FinalMidiSnapshot,
  chords: readonly PerfChord[],
  attacks?: readonly AtomicGrooveAttack[],
  fullVoicings?: readonly FullVoicing[],
): NaturalAtomicMetrics {
  const groups = groupsFor(snapshot);
  const notes = snapshot.notes.filter((note) => note.track === 'accompaniment');
  const pitches = notes.map((note) => note.pitch);
  const velocities = notes.map((note) => note.velocity);
  const durations = notes.map((note) => note.durationBeat);
  const attackVelocityCentroids = groups.map((group) => mean(group.velocities));
  const attackDurationMedians = groups.map((group) => median(group.durations));
  const positiveGaps = groups.slice(0, -1).map((group, index) => {
    const end = group.onset + Math.max(...group.durations);
    return Math.max(0, groups[index + 1]!.onset - end);
  });
  const representatives = representativeGroups(groups, chords);
  const transitions = representatives.slice(1).map((group, index) => ({
    movement: movement(representatives[index]!, group),
    bass: Math.abs(Math.min(...group.pitches) - Math.min(...representatives[index]!.pitches)),
    top: Math.abs(Math.max(...group.pitches) - Math.max(...representatives[index]!.pitches)),
    center: Math.abs(
      (Math.min(...group.pitches) + Math.max(...group.pitches)) / 2 -
        (Math.min(...representatives[index]!.pitches) +
          Math.max(...representatives[index]!.pitches)) /
          2,
    ),
  }));
  const maskCounts = attacks?.reduce<Partial<Record<NaturalVoicingMask, number>>>(
    (counts, attack) => ({
      ...counts,
      [attack.mask]: (counts[attack.mask] ?? 0) + 1,
    }),
    {},
  );
  const leftPitches =
    fullVoicings?.flatMap((voicing) =>
      voicing.notes.filter((note) => note.handRole === 'LEFT').map((note) => note.pitch),
    ) ?? [];
  const rightPitches =
    fullVoicings?.flatMap((voicing) =>
      voicing.notes.filter((note) => note.handRole === 'RIGHT').map((note) => note.pitch),
    ) ?? [];
  const leftMovements =
    fullVoicings?.slice(1).map((voicing, index) => {
      const previous = fullVoicings[index]!;
      const left = voicing.notes.find((note) => note.handRole === 'LEFT')?.pitch ?? 0;
      const previousLeft = previous.notes.find((note) => note.handRole === 'LEFT')?.pitch ?? 0;
      return Math.abs(left - previousLeft);
    }) ?? [];
  const rightCenterMovements =
    fullVoicings?.slice(1).map((voicing, index) => {
      const previous = fullVoicings[index]!;
      const right = voicing.notes
        .filter((note) => note.handRole === 'RIGHT')
        .map((note) => note.pitch);
      const previousRight = previous.notes
        .filter((note) => note.handRole === 'RIGHT')
        .map((note) => note.pitch);
      return Math.abs(mean(right) - mean(previousRight));
    }) ?? [];
  const representativeBasses = representatives.map((group) => Math.min(...group.pitches));
  const representativeTops = representatives.map((group) => Math.max(...group.pitches));
  const representativeCenters = representatives.map(
    (group) => (Math.min(...group.pitches) + Math.max(...group.pitches)) / 2,
  );

  return {
    noteCount: notes.length,
    attackGroupCount: groups.length,
    meanNotesPerAttack: groups.length ? notes.length / groups.length : 0,
    pitchMin: pitches.length ? Math.min(...pitches) : 0,
    pitchMax: pitches.length ? Math.max(...pitches) : 0,
    velocityMean: mean(velocities),
    velocityStdDev: stdDev(velocities),
    durationMean: mean(durations),
    attackVelocityCentroidMean: mean(attackVelocityCentroids),
    attackVelocityCentroidStdDev: stdDev(attackVelocityCentroids),
    attackDurationMedianMean: mean(attackDurationMedians),
    positiveGapMean: mean(positiveGaps),
    restRatio:
      snapshot.totalBeats > 0
        ? positiveGaps.reduce((sum, gap) => sum + gap, 0) / snapshot.totalBeats
        : 0,
    meanChordTransitionMovement: mean(transitions.map((transition) => transition.movement)),
    maxChordTransitionBassJump: transitions.length
      ? Math.max(...transitions.map((transition) => transition.bass))
      : 0,
    maxChordTransitionTopJump: transitions.length
      ? Math.max(...transitions.map((transition) => transition.top))
      : 0,
    maxChordTransitionCenterJump: transitions.length
      ? Math.max(...transitions.map((transition) => transition.center))
      : 0,
    representativeBassMean: mean(representativeBasses),
    representativeTopMean: mean(representativeTops),
    representativeCenterMean: mean(representativeCenters),
    ...(maskCounts ? { maskCounts } : {}),
    ...(fullVoicings && leftPitches.length > 0 && rightPitches.length > 0
      ? {
          handRole: {
            leftMin: Math.min(...leftPitches),
            leftMax: Math.max(...leftPitches),
            rightMin: Math.min(...rightPitches),
            rightMax: Math.max(...rightPitches),
            meanLeftMovement: mean(leftMovements),
            meanRightCenterMovement: mean(rightCenterMovements),
            colorInLeftCount: fullVoicings.flatMap((voicing) =>
              voicing.notes.filter(
                (note) =>
                  note.handRole === 'LEFT' &&
                  ['seventh', 'ninth', 'eleventh', 'thirteenth'].includes(note.degree),
              ),
            ).length,
          },
        }
      : {}),
  };
}
