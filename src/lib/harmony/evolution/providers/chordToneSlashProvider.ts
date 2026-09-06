import { keyTonicPc } from '@/data/music';
import {
  CHORD_FORMULAS,
  DEGREE_TO_SEMITONE,
  MAJOR_DIATONIC,
  MAJOR_DIATONIC_SOURCE,
  NATURAL_MINOR_DIATONIC,
  NATURAL_MINOR_SOURCE,
  SAFE_SLASH_EVOLUTION_POLICY,
  SLASH_CHORD_RULES,
  degreePitchClasses,
  type DegreeToken,
  type DiatonicDegreeRule,
  type SourceRef,
} from '@/lib/musicTheory';
import {
  getDefinitionById,
  getDefinitionBySymbol,
  type ChordDefinition,
} from '@/lib/theory/definitions';
import type { KeyMode, MajorKey } from '@/types';

import type { EvolutionSlashProvider, SlashBassResolution } from '../contracts';
import type { EvolutionChord, EvolutionContext } from '../types';

function wrapPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

function pitchClasses(intervals: readonly number[]): readonly number[] {
  return [...new Set(intervals.map(wrapPitchClass))].sort((left, right) => left - right);
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceDefinition(chord: EvolutionChord): ChordDefinition | null {
  const { definitionId, suffix } = chord.symbol;
  if (definitionId) {
    const byId = getDefinitionById(definitionId);
    return byId?.symbol === suffix ? byId : null;
  }
  return getDefinitionBySymbol(suffix) ?? null;
}

function harmonicContext(
  session: { readonly tonic: MajorKey; readonly mode: KeyMode },
  chord: EvolutionChord,
): { tonic: MajorKey; mode: KeyMode } {
  const local = chord.localHarmonicContext;
  return local?.kind === 'EXPLICIT_LOCAL'
    ? { tonic: local.tonic, mode: local.mode }
    : { tonic: session.tonic, mode: session.mode };
}

function degreeTable(mode: KeyMode): readonly DiatonicDegreeRule[] {
  return mode === 'minor' ? NATURAL_MINOR_DIATONIC : MAJOR_DIATONIC;
}

function degreeSources(mode: KeyMode): readonly SourceRef[] {
  return mode === 'minor' ? NATURAL_MINOR_SOURCE : MAJOR_DIATONIC_SOURCE;
}

function absoluteBassPitchClass(
  session: Pick<EvolutionContext, 'tonic' | 'mode'>,
  chord: EvolutionChord,
): number {
  const context = harmonicContext(session, chord);
  return wrapPitchClass(
    keyTonicPc(context.tonic) + (chord.symbol.bassOffset ?? chord.symbol.rootOffset),
  );
}

function pitchClassDistance(left: number, right: number): number {
  const distance = Math.abs(wrapPitchClass(left) - wrapPitchClass(right));
  return Math.min(distance, 12 - distance);
}

type Movement = {
  total: number;
  maximumLeap: number;
};

function movement(
  candidateBass: number,
  previousBass: number | null,
  nextBass: number | null,
): Movement {
  const leaps = [
    ...(previousBass == null ? [] : [pitchClassDistance(previousBass, candidateBass)]),
    ...(nextBass == null ? [] : [pitchClassDistance(candidateBass, nextBass)]),
  ];
  return {
    total: leaps.reduce((sum, leap) => sum + leap, 0),
    maximumLeap: leaps.length > 0 ? Math.max(...leaps) : 0,
  };
}

function compareOptions(
  left: Omit<SlashBassResolution, 'priority'>,
  right: Omit<SlashBassResolution, 'priority'>,
): number {
  const byTotal = left.totalMovement - right.totalMovement;
  if (byTotal !== 0) return byTotal;
  const byMaximum = left.maximumLeap - right.maximumLeap;
  if (byMaximum !== 0) return byMaximum;
  const byImprovement = right.improvement - left.improvement;
  if (byImprovement !== 0) return byImprovement;
  const degreeOrder = SAFE_SLASH_EVOLUTION_POLICY.allowedBassDegrees;
  const byDegree = degreeOrder.indexOf(left.bassDegree) - degreeOrder.indexOf(right.bassDegree);
  return byDegree !== 0 ? byDegree : left.bassOffset - right.bassOffset;
}

const CHORD_TONE_SLASH_RULE = SLASH_CHORD_RULES.find((rule) => rule.id === 'chord_tone_bass');

export const chordToneSlashProvider: EvolutionSlashProvider = {
  resolveChordToneBassOptions(context, targetIndex): readonly SlashBassResolution[] {
    const chord = context.progression[targetIndex];
    if (!CHORD_TONE_SLASH_RULE || !chord || chord.symbol.bassOffset != null) {
      return [];
    }
    const previous = context.progression[targetIndex - 1] ?? null;
    const next = context.progression[targetIndex + 1] ?? null;
    if (!previous && !next) return [];

    const activeContext = harmonicContext(context, chord);
    const degrees = degreeTable(activeContext.mode);
    const rootOffset = wrapPitchClass(chord.symbol.rootOffset);
    const degree = degrees.find((candidate) => candidate.rootOffset === rootOffset);
    const source = sourceDefinition(chord);
    if (!degree || !source || source.category !== 'seventh') return [];

    const expectedCore = pitchClasses(degreePitchClasses(CHORD_FORMULAS[degree.seventh].degrees));
    if (!sameNumbers(pitchClasses(source.intervals), expectedCore)) return [];

    const previousBass = previous ? absoluteBassPitchClass(context, previous) : null;
    const nextBass = next ? absoluteBassPitchClass(context, next) : null;
    const rootBass = absoluteBassPitchClass(context, chord);
    const baseline = movement(rootBass, previousBass, nextBass);
    const sourcePcs = new Set(pitchClasses(source.intervals));
    const candidates: Omit<SlashBassResolution, 'priority'>[] = [];

    for (const bassDegree of SAFE_SLASH_EVOLUTION_POLICY.allowedBassDegrees) {
      const interval = DEGREE_TO_SEMITONE[bassDegree];
      if (!sourcePcs.has(wrapPitchClass(interval))) continue;
      const bassOffset = wrapPitchClass(rootOffset + interval);
      const candidateBass = wrapPitchClass(keyTonicPc(activeContext.tonic) + bassOffset);
      const candidateMovement = movement(candidateBass, previousBass, nextBass);
      if (
        candidateMovement.total >= baseline.total ||
        candidateMovement.maximumLeap > baseline.maximumLeap
      ) {
        continue;
      }
      candidates.push({
        targetChordId: `evolution:slash:${source.id}:bass-${bassOffset}`,
        bassOffset,
        bassDegree: bassDegree as DegreeToken,
        totalMovement: candidateMovement.total,
        maximumLeap: candidateMovement.maximumLeap,
        improvement: baseline.total - candidateMovement.total,
        theorySources: [
          ...degreeSources(activeContext.mode),
          ...CHORD_TONE_SLASH_RULE.source,
          SAFE_SLASH_EVOLUTION_POLICY.source,
        ],
      });
    }

    return candidates.sort(compareOptions).map((candidate) => {
      const degreeRank = SAFE_SLASH_EVOLUTION_POLICY.allowedBassDegrees.indexOf(
        candidate.bassDegree,
      );
      return {
        ...candidate,
        priority:
          candidate.totalMovement * 1_000_000 +
          candidate.maximumLeap * 100_000 +
          (12 - candidate.improvement) * 1_000 +
          degreeRank * 100 +
          candidate.bassOffset,
      };
    });
  },
};
