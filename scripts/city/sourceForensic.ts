import { createHash } from 'node:crypto';

import {
  parseSmfDetailed,
  tickToBeat,
  type SmfDetailed,
} from '@/lib/accompanimentQuality/smfDetailed';
import type { SmfNote } from '@/lib/performance/library/ingest/smf';

export const CITY_ATTACK_GROUP_TOLERANCE_BEATS = 1 / 32;

type NumericSummary = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  standardDeviation: number | null;
};

type SourceAttackGroup = {
  index: number;
  track: number;
  onsetTick: number;
  onsetBeat: number;
  barIndex: number;
  beatInBar: number;
  noteCount: number;
  pitchMin: number;
  pitchMax: number;
  velocityCentroid: number;
  normalizedVelocity: number;
  durationMedianBeats: number;
  durationMinBeats: number;
  durationMaxBeats: number;
  releaseBeat: number;
  interOnsetBeats: number | null;
  gateRatioToNext: number | null;
  gapToNextAttackBeats: number | null;
  gapTarget: 'NEXT_ATTACK' | 'LOOP_END';
  intraChordSpreadTicks: number;
  intraChordSpreadBeats: number;
  intraChordSpreadMs: number;
  relativeOnsetTicksByAscendingPitch: number[];
  rollDirection: 'SIMULTANEOUS' | 'ASCENDING' | 'DESCENDING' | 'MIXED';
  nearestSixteenthDeviationTicks: number;
  nearestSixteenthDeviationBeats: number;
  nearestSixteenthDeviationMs: number;
  metricPosition: 'DOWNBEAT' | 'QUARTER' | 'EIGHTH_OFFBEAT' | 'SIXTEENTH' | 'OTHER';
  offbeat: boolean;
  crossesNextQuarterBeat: boolean;
  accentedOffbeat: boolean;
};

type BarPattern = {
  barIndex: number;
  attackCount: number;
  onsetSignature: string;
  gestureSignature: string;
};

export type CitySourceForensic = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    fileName: string;
    byteLength: number;
    sha256: string;
  };
  grouping: {
    toleranceTicks: number;
    toleranceBeats: number;
    toleranceAtSourceTempoMs: number;
    rule: string;
    selectedTrackIndex: number;
    selectedTrackReason: string;
  };
  file: {
    format: number;
    ppq: number;
    trackCount: number;
    trackNames: string[];
    tempoEvents: { tick: number; beat: number; bpm: number }[];
    firstTempoBpm: number | null;
    timeSignatures: {
      tick: number;
      beat: number;
      numerator: number;
      denominator: number;
    }[];
    analysisTimeSignature: { numerator: number; denominator: number };
    maxEndTick: number;
    lastNoteOffTick: number;
    totalBeats: number;
    barCount: number;
    warnings: string[];
  };
  notes: {
    totalFileNoteCount: number;
    selectedTrackNoteCount: number;
    pitchRange: { min: number | null; max: number | null };
    velocity: NumericSummary;
    durationTicks: NumericSummary;
    durationBeats: NumericSummary;
    perTrack: {
      index: number;
      name: string;
      noteCount: number;
      pitchMin: number | null;
      pitchMax: number | null;
      attackGroupCount: number;
      meanNotesPerAttack: number | null;
    }[];
  };
  controlChanges: {
    totalCount: number;
    cc64Present: boolean;
    cc64Count: number;
    byController: {
      controller: number;
      count: number;
      minValue: number;
      maxValue: number;
    }[];
    events: {
      tick: number;
      beat: number;
      track: number;
      channel: number;
      controller: number;
      value: number;
    }[];
  };
  attacks: {
    count: number;
    densityPerBar: number;
    notesPerAttack: NumericSummary;
    intraChordSpreadTicks: NumericSummary;
    intraChordSpreadMs: NumericSummary;
    strictSimultaneousCount: number;
    rolledAttackCount: number;
    rollPatternCounts: {
      relativeOnsetTicksByAscendingPitch: number[];
      direction: SourceAttackGroup['rollDirection'];
      count: number;
    }[];
    offbeatCount: number;
    offbeatRatio: number;
    accentedOffbeatCount: number;
    accentedOffbeatRatio: number;
    crossesNextQuarterCount: number;
    syncopationRatio: number;
    positionCounts: Record<SourceAttackGroup['metricPosition'], number>;
    onsetSixteenthDeviationTicks: NumericSummary;
    onsetSixteenthDeviationMs: NumericSummary;
    durationBeats: NumericSummary;
    gateRatioToNext: NumericSummary;
    gapToNextAttackBeats: NumericSummary;
    positiveRestCount: number;
    totalPositiveRestBeats: number;
    velocityCentroid: NumericSummary;
    velocityContour: number[];
    accentHierarchy: {
      metricPosition: SourceAttackGroup['metricPosition'];
      count: number;
      meanVelocity: number | null;
    }[];
    groups: SourceAttackGroup[];
  };
  phrase: {
    barPatterns: BarPattern[];
    repeatedOnsetPatternGroups: number[][];
    repeatedGesturePatternGroups: number[][];
    onsetPairRepeatRatio: number;
    gesturePairRepeatRatio: number;
  };
  abstractionNotes: string[];
};

function rounded(value: number, digits = 6): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function quantile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo]!;
  const mix = index - lo;
  return sorted[lo]! * (1 - mix) + sorted[hi]! * mix;
}

function summarize(values: readonly number[]): NumericSummary {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p10: null,
      p25: null,
      p75: null,
      p90: null,
      standardDeviation: null,
    };
  }
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    min: rounded(sorted[0]!),
    max: rounded(sorted[sorted.length - 1]!),
    mean: rounded(mean),
    median: rounded(quantile(sorted, 0.5)!),
    p10: rounded(quantile(sorted, 0.1)!),
    p25: rounded(quantile(sorted, 0.25)!),
    p75: rounded(quantile(sorted, 0.75)!),
    p90: rounded(quantile(sorted, 0.9)!),
    standardDeviation: rounded(Math.sqrt(variance)),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function median(values: readonly number[]): number {
  return (
    quantile(
      [...values].sort((left, right) => left - right),
      0.5,
    ) ?? 0
  );
}

function groupNotes(notes: readonly SmfNote[], toleranceTicks: number): SmfNote[][] {
  const sorted = [...notes].sort(
    (left, right) => left.tick - right.tick || left.pitch - right.pitch,
  );
  const groups: SmfNote[][] = [];
  for (const note of sorted) {
    const current = groups[groups.length - 1];
    if (!current || note.tick - current[0]!.tick > toleranceTicks) {
      groups.push([note]);
    } else {
      current.push(note);
    }
  }
  return groups;
}

function rollProfile(group: readonly SmfNote[]): {
  relativeOnsetTicksByAscendingPitch: number[];
  direction: SourceAttackGroup['rollDirection'];
} {
  const firstTick = Math.min(...group.map((note) => note.tick));
  const offsets = [...group]
    .sort((left, right) => left.pitch - right.pitch)
    .map((note) => note.tick - firstTick);
  if (offsets.every((offset) => offset === offsets[0])) {
    return { relativeOnsetTicksByAscendingPitch: offsets, direction: 'SIMULTANEOUS' };
  }
  const ascending = offsets.every((offset, index) => index === 0 || offset >= offsets[index - 1]!);
  const descending = offsets.every((offset, index) => index === 0 || offset <= offsets[index - 1]!);
  return {
    relativeOnsetTicksByAscendingPitch: offsets,
    direction: ascending ? 'ASCENDING' : descending ? 'DESCENDING' : 'MIXED',
  };
}

function metricPosition(
  onsetBeat: number,
  beatsPerBar: number,
  toleranceBeats: number,
): SourceAttackGroup['metricPosition'] {
  const inBar = ((onsetBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  if (Math.abs(inBar) <= toleranceBeats || Math.abs(inBar - beatsPerBar) <= toleranceBeats) {
    return 'DOWNBEAT';
  }
  if (Math.abs(inBar - Math.round(inBar)) <= toleranceBeats) return 'QUARTER';
  if (Math.abs(inBar * 2 - Math.round(inBar * 2)) <= toleranceBeats * 2) {
    return 'EIGHTH_OFFBEAT';
  }
  if (Math.abs(inBar * 4 - Math.round(inBar * 4)) <= toleranceBeats * 4) {
    return 'SIXTEENTH';
  }
  return 'OTHER';
}

function repeatedPatternGroups(
  bars: readonly BarPattern[],
  key: 'onsetSignature' | 'gestureSignature',
): number[][] {
  const grouped = new Map<string, number[]>();
  for (const bar of bars) {
    const indices = grouped.get(bar[key]) ?? [];
    indices.push(bar.barIndex);
    grouped.set(bar[key], indices);
  }
  return [...grouped.values()].filter((indices) => indices.length > 1);
}

function pairRepeatRatio(bars: readonly BarPattern[], key: keyof BarPattern): number {
  let pairs = 0;
  let matches = 0;
  for (let left = 0; left < bars.length; left += 1) {
    for (let right = left + 1; right < bars.length; right += 1) {
      pairs += 1;
      if (bars[left]![key] === bars[right]![key]) matches += 1;
    }
  }
  return pairs === 0 ? 0 : matches / pairs;
}

function noteTrackSnapshot(
  song: SmfDetailed,
  track: number,
  toleranceTicks: number,
): CitySourceForensic['notes']['perTrack'][number] {
  const notes = song.notes.filter((note) => note.track === track);
  const groups = groupNotes(notes, toleranceTicks);
  return {
    index: track,
    name: song.trackNames[track] ?? '',
    noteCount: notes.length,
    pitchMin: notes.length ? Math.min(...notes.map((note) => note.pitch)) : null,
    pitchMax: notes.length ? Math.max(...notes.map((note) => note.pitch)) : null,
    attackGroupCount: groups.length,
    meanNotesPerAttack: groups.length ? rounded(notes.length / groups.length) : null,
  };
}

function selectChordTrack(
  song: SmfDetailed,
  perTrack: CitySourceForensic['notes']['perTrack'],
): number {
  const candidates = perTrack.filter((track) => track.noteCount > 0);
  if (candidates.length === 0) throw new Error('Reference MIDI has no paired note events');
  candidates.sort(
    (left, right) =>
      (right.meanNotesPerAttack ?? 0) - (left.meanNotesPerAttack ?? 0) ||
      right.noteCount - left.noteCount ||
      left.index - right.index,
  );
  return candidates[0]!.index;
}

function barPatterns(attacks: readonly SourceAttackGroup[], barCount: number): BarPattern[] {
  return Array.from({ length: barCount }, (_, barIndex) => {
    const inBar = attacks.filter((attack) => attack.barIndex === barIndex);
    const onsetSignature = inBar.map((attack) => rounded(attack.beatInBar, 4).toString()).join(',');
    const gestureSignature = inBar
      .map(
        (attack) =>
          `${rounded(attack.beatInBar, 4)}:${rounded(attack.durationMedianBeats, 3)}:${rounded(
            attack.normalizedVelocity,
            2,
          )}`,
      )
      .join('|');
    return { barIndex, attackCount: inBar.length, onsetSignature, gestureSignature };
  });
}

export function analyzeCitySourceMidi(bytes: Uint8Array, fileName: string): CitySourceForensic {
  const song = parseSmfDetailed(bytes);
  const toleranceTicks = Math.max(1, Math.round(song.ppq * CITY_ATTACK_GROUP_TOLERANCE_BEATS));
  const firstTempo = song.tempos[0];
  const usPerQuarter = firstTempo?.usPerQuarter ?? 500_000;
  const msPerTick = usPerQuarter / 1000 / song.ppq;
  const firstSignature = song.timeSignatures[0] ?? {
    tick: 0,
    numerator: 4,
    denominator: 4,
  };
  const beatsPerBar = firstSignature.numerator * (4 / firstSignature.denominator);
  const lastNoteOffTick = Math.max(
    0,
    ...song.notes.map((note) => note.tick + note.durTicks),
    ...song.controlChanges.map((event) => event.tick),
  );
  const maxEndTick = Math.max(lastNoteOffTick, ...song.trackEndTicks);
  const totalBeats = tickToBeat(maxEndTick, song.ppq);
  const barCount = Math.max(1, Math.ceil(totalBeats / beatsPerBar - 1e-9));
  const perTrack = Array.from({ length: song.trackCount }, (_, track) =>
    noteTrackSnapshot(song, track, toleranceTicks),
  );
  const selectedTrackIndex = selectChordTrack(song, perTrack);
  const selectedNotes = song.notes.filter((note) => note.track === selectedTrackIndex);
  const rawGroups = groupNotes(selectedNotes, toleranceTicks);
  const globalVelocityMedian = median(
    rawGroups.map((group) => mean(group.map((note) => note.velocity))),
  );

  const groups: SourceAttackGroup[] = rawGroups.map((group, index) => {
    const firstTick = group[0]!.tick;
    const lastOnsetTick = Math.max(...group.map((note) => note.tick));
    const onsetBeat = tickToBeat(firstTick, song.ppq);
    const nextAttackTick = rawGroups[index + 1]?.[0]?.tick;
    const nextTick = nextAttackTick ?? maxEndTick;
    const interOnsetBeats =
      nextTick > firstTick ? tickToBeat(nextTick - firstTick, song.ppq) : null;
    const durationBeats = group.map((note) => tickToBeat(note.durTicks, song.ppq));
    const releaseTick = Math.max(...group.map((note) => note.tick + note.durTicks));
    const releaseBeat = tickToBeat(releaseTick, song.ppq);
    const velocityCentroid = mean(group.map((note) => note.velocity));
    const nearestSixteenthTick = Math.round(firstTick / (song.ppq / 4)) * (song.ppq / 4);
    const deviationTicks = firstTick - nearestSixteenthTick;
    const inBar = ((onsetBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
    const position = metricPosition(onsetBeat, beatsPerBar, CITY_ATTACK_GROUP_TOLERANCE_BEATS);
    const offbeat = Math.abs(onsetBeat - Math.round(onsetBeat)) > CITY_ATTACK_GROUP_TOLERANCE_BEATS;
    const nextQuarter = Math.floor(onsetBeat + CITY_ATTACK_GROUP_TOLERANCE_BEATS) + 1;
    const roll = rollProfile(group);
    return {
      index,
      track: selectedTrackIndex,
      onsetTick: firstTick,
      onsetBeat: rounded(onsetBeat),
      barIndex: Math.floor(onsetBeat / beatsPerBar),
      beatInBar: rounded(inBar),
      noteCount: group.length,
      pitchMin: Math.min(...group.map((note) => note.pitch)),
      pitchMax: Math.max(...group.map((note) => note.pitch)),
      velocityCentroid: rounded(velocityCentroid),
      normalizedVelocity: 0,
      durationMedianBeats: rounded(median(durationBeats)),
      durationMinBeats: rounded(Math.min(...durationBeats)),
      durationMaxBeats: rounded(Math.max(...durationBeats)),
      releaseBeat: rounded(releaseBeat),
      interOnsetBeats: interOnsetBeats == null ? null : rounded(interOnsetBeats),
      gateRatioToNext:
        interOnsetBeats == null || interOnsetBeats <= 0
          ? null
          : rounded(median(durationBeats) / interOnsetBeats),
      gapToNextAttackBeats:
        nextTick > releaseTick ? rounded(tickToBeat(nextTick - releaseTick, song.ppq)) : 0,
      gapTarget: nextAttackTick == null ? 'LOOP_END' : 'NEXT_ATTACK',
      intraChordSpreadTicks: lastOnsetTick - firstTick,
      intraChordSpreadBeats: rounded(tickToBeat(lastOnsetTick - firstTick, song.ppq)),
      intraChordSpreadMs: rounded((lastOnsetTick - firstTick) * msPerTick, 3),
      relativeOnsetTicksByAscendingPitch: roll.relativeOnsetTicksByAscendingPitch,
      rollDirection: roll.direction,
      nearestSixteenthDeviationTicks: rounded(deviationTicks, 3),
      nearestSixteenthDeviationBeats: rounded(deviationTicks / song.ppq),
      nearestSixteenthDeviationMs: rounded(deviationTicks * msPerTick, 3),
      metricPosition: position,
      offbeat,
      crossesNextQuarterBeat: offbeat && releaseBeat > nextQuarter + 1e-9,
      accentedOffbeat: offbeat && velocityCentroid >= globalVelocityMedian,
    };
  });
  const attackVelocityMean = mean(groups.map((group) => group.velocityCentroid));
  for (const group of groups) {
    group.normalizedVelocity = rounded(
      attackVelocityMean > 0 ? group.velocityCentroid / attackVelocityMean : 1,
      4,
    );
  }

  const positions: Record<SourceAttackGroup['metricPosition'], number> = {
    DOWNBEAT: 0,
    QUARTER: 0,
    EIGHTH_OFFBEAT: 0,
    SIXTEENTH: 0,
    OTHER: 0,
  };
  for (const group of groups) positions[group.metricPosition] += 1;
  const ccByController = new Map<number, number[]>();
  for (const event of song.controlChanges) {
    const values = ccByController.get(event.controller) ?? [];
    values.push(event.value);
    ccByController.set(event.controller, values);
  }
  const bars = barPatterns(groups, barCount);
  const rollPatterns = new Map<
    string,
    CitySourceForensic['attacks']['rollPatternCounts'][number]
  >();
  for (const group of groups) {
    const key = `${group.rollDirection}:${group.relativeOnsetTicksByAscendingPitch.join(',')}`;
    const current = rollPatterns.get(key);
    if (current) current.count += 1;
    else {
      rollPatterns.set(key, {
        relativeOnsetTicksByAscendingPitch: group.relativeOnsetTicksByAscendingPitch,
        direction: group.rollDirection,
        count: 1,
      });
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      fileName,
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    grouping: {
      toleranceTicks,
      toleranceBeats: CITY_ATTACK_GROUP_TOLERANCE_BEATS,
      toleranceAtSourceTempoMs: rounded(toleranceTicks * msPerTick, 3),
      rule: 'Within one MIDI track, sorted NoteOns join the current Attack Group when onsetTick - firstGroupOnsetTick <= toleranceTicks.',
      selectedTrackIndex,
      selectedTrackReason:
        'Highest mean notes per grouped attack, then highest note count; deterministic tie-break by track index.',
    },
    file: {
      format: song.format,
      ppq: song.ppq,
      trackCount: song.trackCount,
      trackNames: song.trackNames,
      tempoEvents: song.tempos.map((tempo) => ({
        tick: tempo.tick,
        beat: rounded(tickToBeat(tempo.tick, song.ppq)),
        bpm: rounded(60_000_000 / tempo.usPerQuarter, 3),
      })),
      firstTempoBpm: firstTempo ? rounded(60_000_000 / firstTempo.usPerQuarter, 3) : null,
      timeSignatures: song.timeSignatures.map((signature) => ({
        tick: signature.tick,
        beat: rounded(tickToBeat(signature.tick, song.ppq)),
        numerator: signature.numerator,
        denominator: signature.denominator,
      })),
      analysisTimeSignature: {
        numerator: firstSignature.numerator,
        denominator: firstSignature.denominator,
      },
      maxEndTick,
      lastNoteOffTick,
      totalBeats: rounded(totalBeats),
      barCount,
      warnings: song.warnings,
    },
    notes: {
      totalFileNoteCount: song.notes.length,
      selectedTrackNoteCount: selectedNotes.length,
      pitchRange: {
        min: selectedNotes.length ? Math.min(...selectedNotes.map((note) => note.pitch)) : null,
        max: selectedNotes.length ? Math.max(...selectedNotes.map((note) => note.pitch)) : null,
      },
      velocity: summarize(selectedNotes.map((note) => note.velocity)),
      durationTicks: summarize(selectedNotes.map((note) => note.durTicks)),
      durationBeats: summarize(selectedNotes.map((note) => tickToBeat(note.durTicks, song.ppq))),
      perTrack,
    },
    controlChanges: {
      totalCount: song.controlChanges.length,
      cc64Present: song.controlChanges.some((event) => event.controller === 64),
      cc64Count: song.controlChanges.filter((event) => event.controller === 64).length,
      byController: [...ccByController.entries()]
        .sort(([left], [right]) => left - right)
        .map(([controller, values]) => ({
          controller,
          count: values.length,
          minValue: Math.min(...values),
          maxValue: Math.max(...values),
        })),
      events: song.controlChanges.map((event) => ({
        tick: event.tick,
        beat: rounded(tickToBeat(event.tick, song.ppq)),
        track: event.track,
        channel: event.channel,
        controller: event.controller,
        value: event.value,
      })),
    },
    attacks: {
      count: groups.length,
      densityPerBar: rounded(groups.length / barCount),
      notesPerAttack: summarize(groups.map((group) => group.noteCount)),
      intraChordSpreadTicks: summarize(groups.map((group) => group.intraChordSpreadTicks)),
      intraChordSpreadMs: summarize(groups.map((group) => group.intraChordSpreadMs)),
      strictSimultaneousCount: groups.filter((group) => group.intraChordSpreadTicks === 0).length,
      rolledAttackCount: groups.filter((group) => group.intraChordSpreadTicks > 0).length,
      rollPatternCounts: [...rollPatterns.values()].sort((left, right) => right.count - left.count),
      offbeatCount: groups.filter((group) => group.offbeat).length,
      offbeatRatio: rounded(
        groups.filter((group) => group.offbeat).length / Math.max(1, groups.length),
      ),
      accentedOffbeatCount: groups.filter((group) => group.accentedOffbeat).length,
      accentedOffbeatRatio: rounded(
        groups.filter((group) => group.accentedOffbeat).length / Math.max(1, groups.length),
      ),
      crossesNextQuarterCount: groups.filter((group) => group.crossesNextQuarterBeat).length,
      syncopationRatio: rounded(
        groups.filter((group) => group.crossesNextQuarterBeat).length / Math.max(1, groups.length),
      ),
      positionCounts: positions,
      onsetSixteenthDeviationTicks: summarize(
        groups.map((group) => group.nearestSixteenthDeviationTicks),
      ),
      onsetSixteenthDeviationMs: summarize(
        groups.map((group) => group.nearestSixteenthDeviationMs),
      ),
      durationBeats: summarize(groups.map((group) => group.durationMedianBeats)),
      gateRatioToNext: summarize(
        groups
          .map((group) => group.gateRatioToNext)
          .filter((value): value is number => value != null),
      ),
      gapToNextAttackBeats: summarize(
        groups
          .map((group) => group.gapToNextAttackBeats)
          .filter((value): value is number => value != null),
      ),
      positiveRestCount: groups.filter(
        (group) => (group.gapToNextAttackBeats ?? 0) > CITY_ATTACK_GROUP_TOLERANCE_BEATS,
      ).length,
      totalPositiveRestBeats: rounded(
        groups.reduce((sum, group) => sum + Math.max(0, group.gapToNextAttackBeats ?? 0), 0),
      ),
      velocityCentroid: summarize(groups.map((group) => group.velocityCentroid)),
      velocityContour: groups.map((group) => group.normalizedVelocity),
      accentHierarchy: (Object.keys(positions) as SourceAttackGroup['metricPosition'][]).map(
        (position) => {
          const values = groups
            .filter((group) => group.metricPosition === position)
            .map((group) => group.velocityCentroid);
          return {
            metricPosition: position,
            count: values.length,
            meanVelocity: values.length ? rounded(mean(values)) : null,
          };
        },
      ),
      groups,
    },
    phrase: {
      barPatterns: bars,
      repeatedOnsetPatternGroups: repeatedPatternGroups(bars, 'onsetSignature'),
      repeatedGesturePatternGroups: repeatedPatternGroups(bars, 'gestureSignature'),
      onsetPairRepeatRatio: rounded(pairRepeatRatio(bars, 'onsetSignature')),
      gesturePairRepeatRatio: rounded(pairRepeatRatio(bars, 'gestureSignature')),
    },
    abstractionNotes: [
      'Attack metrics use only the selected chord-comping track; file-level note and track counts remain complete.',
      'Pitch is measured for forensic register/polyphony only and must not enter the Production City Groove Asset.',
      'Gate ratio is median note duration divided by time to the next Attack Group.',
      'Gap is next Attack onset minus the latest NoteOff in the current Attack Group; positive values are silence.',
      'For the final Attack Group, gap is measured to the actual End-of-Track loop boundary.',
      'Syncopation ratio counts offbeat attacks whose latest NoteOff crosses the next quarter-note boundary.',
      'Velocity contour is attack velocity centroid divided by the source-wide attack centroid mean.',
      'Microtiming deviation is measured from the nearest sixteenth-note grid; no randomization is inferred.',
    ],
  };
}

function value(summary: NumericSummary, key: keyof NumericSummary): string {
  const raw = summary[key];
  return raw == null ? 'n/a' : String(raw);
}

export function renderCitySourceForensicMarkdown(report: CitySourceForensic): string {
  const lines: string[] = [
    '# City Type1 Reference MIDI — Source Forensic',
    '',
    `Generated: ${report.generatedAt}`,
    `Source SHA-256: \`${report.source.sha256}\``,
    '',
    '## Grouping contract',
    '',
    `- Tolerance: **${report.grouping.toleranceTicks} ticks = ${report.grouping.toleranceBeats} beats = ${report.grouping.toleranceAtSourceTempoMs} ms at source tempo**`,
    `- Rule: ${report.grouping.rule}`,
    `- Selected chord track: **${report.grouping.selectedTrackIndex}** — ${report.grouping.selectedTrackReason}`,
    '',
    '## File facts',
    '',
    `- Format / PPQ: **${report.file.format} / ${report.file.ppq}**`,
    `- Tempo: **${report.file.firstTempoBpm ?? 'no tempo event'} BPM**`,
    `- Time signature: **${report.file.analysisTimeSignature.numerator}/${report.file.analysisTimeSignature.denominator}**`,
    `- Length: **${report.file.totalBeats} beats / ${report.file.barCount} bars**`,
    `- Last NoteOff / file end: **${report.file.lastNoteOffTick} / ${report.file.maxEndTick} ticks**`,
    `- Tracks: **${report.file.trackCount}**`,
    `- Notes: **${report.notes.totalFileNoteCount} total / ${report.notes.selectedTrackNoteCount} selected track**`,
    `- Pitch range: **${report.notes.pitchRange.min}–${report.notes.pitchRange.max}**`,
    `- CC events: **${report.controlChanges.totalCount}**`,
    `- CC64: **${report.controlChanges.cc64Present ? `present (${report.controlChanges.cc64Count})` : 'absent'}**`,
    '',
    '## Attack / release / rest',
    '',
    `- Attack Groups: **${report.attacks.count}** (${report.attacks.densityPerBar} per bar)`,
    `- Notes per attack median / range: **${value(report.attacks.notesPerAttack, 'median')} / ${value(report.attacks.notesPerAttack, 'min')}–${value(report.attacks.notesPerAttack, 'max')}**`,
    `- Duration beats median / p10–p90: **${value(report.attacks.durationBeats, 'median')} / ${value(report.attacks.durationBeats, 'p10')}–${value(report.attacks.durationBeats, 'p90')}**`,
    `- Gate ratio median / p10–p90: **${value(report.attacks.gateRatioToNext, 'median')} / ${value(report.attacks.gateRatioToNext, 'p10')}–${value(report.attacks.gateRatioToNext, 'p90')}**`,
    `- Gap beats median / p10–p90: **${value(report.attacks.gapToNextAttackBeats, 'median')} / ${value(report.attacks.gapToNextAttackBeats, 'p10')}–${value(report.attacks.gapToNextAttackBeats, 'p90')}**`,
    `- Positive rests: **${report.attacks.positiveRestCount}**, total **${report.attacks.totalPositiveRestBeats} beats**`,
    '',
    '## Rhythm and syncopation',
    '',
    `- Offbeat: **${report.attacks.offbeatCount}/${report.attacks.count} (${report.attacks.offbeatRatio})**`,
    `- Accented offbeat: **${report.attacks.accentedOffbeatCount}/${report.attacks.count} (${report.attacks.accentedOffbeatRatio})**`,
    `- Offbeat crossing next quarter: **${report.attacks.crossesNextQuarterCount}/${report.attacks.count} (${report.attacks.syncopationRatio})**`,
    `- Metric positions: \`${JSON.stringify(report.attacks.positionCounts)}\``,
    `- Nearest-16th deviation median / max absolute: **${value(report.attacks.onsetSixteenthDeviationTicks, 'median')} / ${Math.max(
      Math.abs(report.attacks.onsetSixteenthDeviationTicks.min ?? 0),
      Math.abs(report.attacks.onsetSixteenthDeviationTicks.max ?? 0),
    )} ticks**`,
    '',
    '## Intra-chord onset spread',
    '',
    `- Strict simultaneous: **${report.attacks.strictSimultaneousCount}**`,
    `- Non-zero spread: **${report.attacks.rolledAttackCount}**`,
    `- Spread ticks median / max: **${value(report.attacks.intraChordSpreadTicks, 'median')} / ${value(report.attacks.intraChordSpreadTicks, 'max')}**`,
    `- Spread ms median / max: **${value(report.attacks.intraChordSpreadMs, 'median')} / ${value(report.attacks.intraChordSpreadMs, 'max')}**`,
    `- Roll patterns: \`${JSON.stringify(report.attacks.rollPatternCounts)}\``,
    '',
    '## Velocity and accents',
    '',
    `- Note velocity mean / median / p10–p90: **${value(report.notes.velocity, 'mean')} / ${value(report.notes.velocity, 'median')} / ${value(report.notes.velocity, 'p10')}–${value(report.notes.velocity, 'p90')}**`,
    `- Attack centroid mean / range: **${value(report.attacks.velocityCentroid, 'mean')} / ${value(report.attacks.velocityCentroid, 'min')}–${value(report.attacks.velocityCentroid, 'max')}**`,
    `- Normalized contour: \`${report.attacks.velocityContour.join(', ')}\``,
    '- Accent hierarchy:',
    ...report.attacks.accentHierarchy.map(
      (entry) =>
        `  - ${entry.metricPosition}: count=${entry.count}, meanVelocity=${entry.meanVelocity ?? 'n/a'}`,
    ),
    '',
    '## Phrase repetition / variation',
    '',
    `- Onset pair repeat ratio: **${report.phrase.onsetPairRepeatRatio}**`,
    `- Full gesture pair repeat ratio: **${report.phrase.gesturePairRepeatRatio}**`,
    `- Repeated onset bar groups: \`${JSON.stringify(report.phrase.repeatedOnsetPatternGroups)}\``,
    `- Repeated gesture bar groups: \`${JSON.stringify(report.phrase.repeatedGesturePatternGroups)}\``,
    '- Bar patterns:',
    ...report.phrase.barPatterns.map(
      (bar) =>
        `  - bar ${bar.barIndex + 1}: attacks=${bar.attackCount}, onsets=\`${bar.onsetSignature}\`, gestures=\`${bar.gestureSignature}\``,
    ),
    '',
    '## Intentional abstraction',
    '',
    ...report.abstractionNotes.map((note) => `- ${note}`),
    '',
    '## Production boundary',
    '',
    '- This report may contain source pitch/register facts for forensic verification.',
    '- The Production City Groove Asset must contain timing, gate, rest, normalized velocity, accent and optional measured roll only.',
    '- Literal source pitch, chord progression, melody and chromatic material are prohibited from Production City.',
    '',
  ];
  return lines.join('\n');
}
