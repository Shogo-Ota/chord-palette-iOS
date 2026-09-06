import { degreeIndexFromRootOffset, MAJOR_SCALE_OFFSETS } from '@/data/music';
import { getSubstituteDominantRoot, SUBSTITUTE_DOMINANT } from '@/lib/musicTheory';
import { getDefinitionBySymbol } from '@/lib/theory/definitions';
import type { ChordRootSpelling } from '@/types';

import type {
  EvolutionTritoneSubstitutionProvider,
  TritoneSubstitutionResolution,
} from '../contracts';
import {
  isStrictMajorDiatonicTarget,
  normalizedPitchClass,
  sourceDefinition,
} from './providerGuards';

function substituteSpelling(targetRootOffset: number): ChordRootSpelling | null {
  const targetDegree = degreeIndexFromRootOffset(targetRootOffset, 'major');
  if (targetDegree < 0) return null;
  const degreeIndex = (targetDegree + 1) % MAJOR_SCALE_OFFSETS.length;
  const naturalRootOffset = MAJOR_SCALE_OFFSETS[degreeIndex]!;
  const substituteRootOffset = normalizedPitchClass(targetRootOffset + 1);
  const alterationDistance = normalizedPitchClass(substituteRootOffset - naturalRootOffset);
  const alteration = alterationDistance === 0 ? 0 : alterationDistance === 1 ? 1 : -1;
  if (normalizedPitchClass(naturalRootOffset + alteration) !== substituteRootOffset) {
    return null;
  }
  return { degreeIndex, alteration };
}

export const tritoneSubstitutionProvider: EvolutionTritoneSubstitutionProvider = {
  resolveTritoneSubstitutions(context, dominantIndex): readonly TritoneSubstitutionResolution[] {
    if (
      context.level !== 'reharm' ||
      context.mode !== 'major' ||
      context.scope.kind !== 'progression' ||
      dominantIndex < 0 ||
      dominantIndex >= context.progression.length - 1
    ) {
      return [];
    }

    const dominant = context.progression[dominantIndex];
    const resolutionTarget = context.progression[dominantIndex + 1];
    if (
      !dominant ||
      !resolutionTarget ||
      dominant.symbol.bassOffset != null ||
      resolutionTarget.symbol.bassOffset != null ||
      sourceDefinition(dominant)?.id !== 'dom7' ||
      !isStrictMajorDiatonicTarget(context, resolutionTarget) ||
      normalizedPitchClass(dominant.symbol.rootOffset + 5) !==
        normalizedPitchClass(resolutionTarget.symbol.rootOffset)
    ) {
      return [];
    }

    const dominantDefinition = getDefinitionBySymbol('7');
    const rootSpelling = substituteSpelling(resolutionTarget.symbol.rootOffset);
    if (!dominantDefinition || !rootSpelling) return [];

    return [
      {
        dominantIndex,
        targetIndex: dominantIndex + 1,
        targetChordId: `tritone-${dominant.chordId}-${resolutionTarget.eventId}`,
        targetSymbol: {
          rootOffset: getSubstituteDominantRoot(dominant.symbol.rootOffset),
          rootSpelling,
          suffix: dominantDefinition.symbol,
          definitionId: dominantDefinition.id,
        },
        harmonicEffect: 'DOMINANT_SUBSTITUTION',
        resolutionStrength: 5,
        priority: dominantIndex,
        theorySources: SUBSTITUTE_DOMINANT.source,
      },
    ];
  },
};
