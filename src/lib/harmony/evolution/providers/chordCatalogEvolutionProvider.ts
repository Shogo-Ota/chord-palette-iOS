import { degreeIndexFromRootOffset, diatonicSevenths, diatonicTriads } from '@/data/music';
import { MAJOR_DIATONIC_SOURCE, NATURAL_MINOR_SOURCE, type SourceRef } from '@/lib/musicTheory';
import {
  getDefinitionById,
  getDefinitionBySymbol,
  type ChordDefinition,
} from '@/lib/theory/definitions';
import type { KeyMode, MajorKey } from '@/types';

import type { DiatonicSeventhResolution, EvolutionTheoryProvider } from '../contracts';
import type { EvolutionChord } from '../types';

function resolveContext(
  session: { readonly tonic: MajorKey; readonly mode: KeyMode },
  chord: EvolutionChord,
): { tonic: MajorKey; mode: KeyMode } {
  const local = chord.localHarmonicContext;
  return local?.kind === 'EXPLICIT_LOCAL'
    ? { tonic: local.tonic, mode: local.mode }
    : { tonic: session.tonic, mode: session.mode };
}

/** Resolve a source strictly; a supplied id must agree with its suffix. */
function sourceDefinition(chord: EvolutionChord): ChordDefinition | null {
  const { definitionId, suffix } = chord.symbol;
  if (definitionId) {
    const byId = getDefinitionById(definitionId);
    return byId?.symbol === suffix ? byId : null;
  }
  return getDefinitionBySymbol(suffix) ?? null;
}

function sourcesFor(mode: KeyMode): readonly SourceRef[] {
  return mode === 'minor' ? NATURAL_MINOR_SOURCE : MAJOR_DIATONIC_SOURCE;
}

/**
 * Existing theory adapter for Phase 1.
 *
 * The mode tables decide which triad belongs to a degree. CHORD_CATALOG then
 * validates both source and target definitions, so the adapter fails closed
 * instead of inventing a symbol when either side is inconsistent.
 */
export const chordCatalogEvolutionProvider: EvolutionTheoryProvider = {
  resolveDiatonicSeventh(sessionContext, chord): DiatonicSeventhResolution | null {
    const harmonicContext = resolveContext(sessionContext, chord);
    const degreeIndex = degreeIndexFromRootOffset(chord.symbol.rootOffset, harmonicContext.mode);
    if (degreeIndex < 0) return null;

    const expectedTriad = diatonicTriads(harmonicContext.tonic, harmonicContext.mode)[degreeIndex];
    const expectedSeventh = diatonicSevenths(harmonicContext.tonic, harmonicContext.mode)[
      degreeIndex
    ];
    if (!expectedTriad || !expectedSeventh) return null;

    const source = sourceDefinition(chord);
    if (
      !source ||
      !expectedTriad.definitionId ||
      source.id !== expectedTriad.definitionId ||
      source.symbol !== expectedTriad.suffix
    ) {
      return null;
    }

    const target = expectedSeventh.definitionId
      ? getDefinitionById(expectedSeventh.definitionId)
      : getDefinitionBySymbol(expectedSeventh.suffix);
    if (!target || target.symbol !== expectedSeventh.suffix) return null;

    return {
      degreeIndex,
      targetChordId: expectedSeventh.id,
      targetSymbol: {
        ...chord.symbol,
        suffix: target.symbol,
        definitionId: target.id,
      },
      theorySources: sourcesFor(harmonicContext.mode),
    };
  },
};
