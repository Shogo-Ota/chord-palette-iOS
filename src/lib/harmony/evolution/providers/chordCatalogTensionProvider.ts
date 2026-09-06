import {
  CHORD_FORMULAS,
  MAJOR_DIATONIC,
  MAJOR_DIATONIC_SOURCE,
  MAJOR_DIATONIC_TENSIONS,
  NATURAL_MINOR_DIATONIC,
  NATURAL_MINOR_SOURCE,
  NATURAL_MINOR_TENSIONS,
  SAFE_AVAILABLE_TENSION_EVOLUTION_POLICY,
  TENSION_TO_SEMITONE,
  degreePitchClasses,
  type DiatonicDegreeRule,
  type SourceRef,
  type TensionRule,
  type TensionToken,
} from '@/lib/musicTheory';
import {
  CHORD_CATALOG,
  getDefinitionById,
  getDefinitionBySymbol,
  type ChordDefinition,
} from '@/lib/theory/definitions';
import type { KeyMode, MajorKey } from '@/types';

import type { AvailableTensionResolution, EvolutionTensionProvider } from '../contracts';
import type { EvolutionChord } from '../types';

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

function tables(mode: KeyMode): {
  degrees: readonly DiatonicDegreeRule[];
  tensions: readonly TensionRule[];
  sources: readonly SourceRef[];
} {
  return mode === 'minor'
    ? {
        degrees: NATURAL_MINOR_DIATONIC,
        tensions: NATURAL_MINOR_TENSIONS,
        sources: NATURAL_MINOR_SOURCE,
      }
    : {
        degrees: MAJOR_DIATONIC,
        tensions: MAJOR_DIATONIC_TENSIONS,
        sources: MAJOR_DIATONIC_SOURCE,
      };
}

const TENSION_BY_PITCH_CLASS = new Map<number, TensionToken>(
  Object.entries(TENSION_TO_SEMITONE).map(([tension, semitones]) => [
    wrapPitchClass(semitones),
    tension as TensionToken,
  ]),
);

function targetTensions(
  source: ChordDefinition,
  target: ChordDefinition,
): readonly TensionToken[] | null {
  const sourcePcs = new Set(pitchClasses(source.intervals));
  const targetPcs = pitchClasses(target.intervals);
  if (![...sourcePcs].every((pitchClass) => targetPcs.includes(pitchClass))) {
    return null;
  }

  const tensions: TensionToken[] = [];
  for (const pitchClass of targetPcs) {
    if (sourcePcs.has(pitchClass)) continue;
    const tension = TENSION_BY_PITCH_CLASS.get(pitchClass);
    if (!tension) return null;
    tensions.push(tension);
  }
  return tensions.length > 0 ? tensions : null;
}

type RankedTarget = {
  definition: ChordDefinition;
  tensions: readonly TensionToken[];
};

function compareTargets(left: RankedTarget, right: RankedTarget): number {
  const byToneCount = left.tensions.length - right.tensions.length;
  if (byToneCount !== 0) return byToneCount;
  const byCatalogPriority = left.definition.priority - right.definition.priority;
  return byCatalogPriority !== 0
    ? byCatalogPriority
    : left.definition.id.localeCompare(right.definition.id);
}

export const chordCatalogTensionProvider: EvolutionTensionProvider = {
  resolveAvailableTensions(sessionContext, chord): readonly AvailableTensionResolution[] {
    const context = harmonicContext(sessionContext, chord);
    const table = tables(context.mode);
    const rootOffset = wrapPitchClass(chord.symbol.rootOffset);
    const degreeIndex = table.degrees.findIndex((degree) => degree.rootOffset === rootOffset);
    if (degreeIndex < 0) return [];

    const degree = table.degrees[degreeIndex];
    const tensionRule = table.tensions[degreeIndex];
    const source = sourceDefinition(chord);
    if (
      !degree ||
      !tensionRule ||
      !source ||
      source.category !== 'seventh' ||
      degree.chordScale !== tensionRule.chordScale
    ) {
      return [];
    }

    const expectedCore = pitchClasses(degreePitchClasses(CHORD_FORMULAS[degree.seventh].degrees));
    if (!sameNumbers(pitchClasses(source.intervals), expectedCore)) return [];

    const available = new Set(tensionRule.available);
    const avoid = new Set(tensionRule.avoid);
    const targets: RankedTarget[] = [];
    for (const definition of CHORD_CATALOG) {
      if (definition.category !== 'tension' || definition.quality !== source.quality) {
        continue;
      }
      const tensions = targetTensions(source, definition);
      if (!tensions || tensions.some((tension) => !available.has(tension) || avoid.has(tension))) {
        continue;
      }
      targets.push({ definition, tensions });
    }

    return targets.sort(compareTargets).map((target, priority) => ({
      targetChordId: `evolution:${target.definition.id}:root-${rootOffset}`,
      targetSymbol: {
        ...chord.symbol,
        suffix: target.definition.symbol,
        definitionId: target.definition.id,
      },
      addedTensions: target.tensions,
      priority,
      theorySources: [
        ...table.sources,
        ...tensionRule.source,
        SAFE_AVAILABLE_TENSION_EVOLUTION_POLICY.source,
      ],
    }));
  },
};
