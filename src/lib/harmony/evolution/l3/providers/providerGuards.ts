import { degreeIndexFromRootOffset, diatonicSevenths, diatonicTriads } from '@/data/music';
import {
  getDefinitionById,
  getDefinitionBySymbol,
  type ChordDefinition,
} from '@/lib/theory/definitions';

import type { EvolutionChord, EvolutionContext } from '../../types';

export function normalizedPitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function sourceDefinition(chord: EvolutionChord): ChordDefinition | null {
  const { definitionId, suffix } = chord.symbol;
  if (definitionId) {
    const byId = getDefinitionById(definitionId);
    return byId?.symbol === suffix ? byId : null;
  }
  return getDefinitionBySymbol(suffix) ?? null;
}

export function isStrictMajorDiatonicTarget(
  context: Pick<EvolutionContext, 'tonic'>,
  chord: EvolutionChord,
): boolean {
  const degreeIndex = degreeIndexFromRootOffset(chord.symbol.rootOffset, 'major');
  if (degreeIndex < 0) return false;
  const definition = sourceDefinition(chord);
  const triad = diatonicTriads(context.tonic, 'major')[degreeIndex];
  const seventh = diatonicSevenths(context.tonic, 'major')[degreeIndex];
  return (
    definition != null &&
    (definition.id === triad?.definitionId || definition.id === seventh?.definitionId)
  );
}

export function directedSemitone(fromRootOffset: number, toRootOffset: number): -1 | 1 | null {
  const delta = normalizedPitchClass(toRootOffset - fromRootOffset);
  if (delta === 1) return 1;
  if (delta === 11) return -1;
  return null;
}
