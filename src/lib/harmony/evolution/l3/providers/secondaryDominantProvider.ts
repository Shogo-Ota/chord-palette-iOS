import { SECONDARY_DOMINANTS_MAJOR, splitL3InsertionDuration } from '@/lib/musicTheory';
import { getDefinitionBySymbol } from '@/lib/theory/definitions';

import type { EvolutionSecondaryDominantProvider, SecondaryDominantResolution } from '../contracts';
import { isStrictMajorDiatonicTarget } from './providerGuards';

export const secondaryDominantProvider: EvolutionSecondaryDominantProvider = {
  resolveSecondaryDominants(context, targetIndex): readonly SecondaryDominantResolution[] {
    if (
      context.level !== 'reharm' ||
      context.mode !== 'major' ||
      context.scope.kind !== 'progression' ||
      targetIndex <= 0 ||
      targetIndex >= context.progression.length
    ) {
      return [];
    }

    const previous = context.progression[targetIndex - 1];
    const target = context.progression[targetIndex];
    if (!previous || !target || target.symbol.bassOffset != null) return [];
    const split = splitL3InsertionDuration(previous.durationBeats);
    if (!split || !isStrictMajorDiatonicTarget(context, target)) return [];

    const dominantDefinition = getDefinitionBySymbol('7');
    if (!dominantDefinition || dominantDefinition.quality !== 'dominant') return [];

    return SECONDARY_DOMINANTS_MAJOR.flatMap(
      (rule, priority): readonly SecondaryDominantResolution[] => {
        if (rule.targetRootOffsetFromKey !== target.symbol.rootOffset) return [];
        return [
          {
            targetIndex,
            insertedChordId: `secdom-${context.tonic}-${rule.targetDegree}`,
            insertedSymbol: {
              rootOffset: rule.dominantRootOffsetFromKey,
              suffix: dominantDefinition.symbol,
              definitionId: dominantDefinition.id,
            },
            resizedPreviousDuration: split[0],
            insertedDuration: split[1],
            targetDegree: rule.targetDegree,
            targetRootOffset: rule.targetRootOffsetFromKey,
            harmonicEffect: 'DOMINANT_RESOLUTION',
            resolutionStrength: 5,
            priority,
            theorySources: rule.source,
          },
        ];
      },
    );
  },
};
