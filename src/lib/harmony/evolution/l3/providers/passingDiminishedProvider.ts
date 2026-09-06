import { degreeIndexFromRootOffset } from '@/data/music';
import {
  DIMINISHED_RULES,
  MAJOR_PASSING_DIMINISHED_PALETTE,
  splitL3InsertionDuration,
} from '@/lib/musicTheory';
import { getDefinitionBySymbol } from '@/lib/theory/definitions';

import type { EvolutionPassingDiminishedProvider, PassingDiminishedResolution } from '../contracts';
import { directedSemitone, isStrictMajorDiatonicTarget } from './providerGuards';

export const passingDiminishedProvider: EvolutionPassingDiminishedProvider = {
  resolvePassingDiminished(context, targetIndex): readonly PassingDiminishedResolution[] {
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
    if (
      !previous ||
      !target ||
      previous.symbol.bassOffset != null ||
      target.symbol.bassOffset != null ||
      !isStrictMajorDiatonicTarget(context, target)
    ) {
      return [];
    }
    const split = splitL3InsertionDuration(previous.durationBeats);
    const degreeIndex = degreeIndexFromRootOffset(target.symbol.rootOffset, 'major');
    const diminishedDefinition = getDefinitionBySymbol('dim7');
    if (
      !split ||
      degreeIndex < 0 ||
      !diminishedDefinition ||
      !DIMINISHED_RULES.passingDiminishedUse
    ) {
      return [];
    }

    return MAJOR_PASSING_DIMINISHED_PALETTE.flatMap(
      (rule, priority): readonly PassingDiminishedResolution[] => {
        if (rule.targetDegreeIndex !== degreeIndex) return [];
        const firstStep = directedSemitone(previous.symbol.rootOffset, rule.rootOffset);
        const secondStep = directedSemitone(rule.rootOffset, target.symbol.rootOffset);
        if (!firstStep || firstStep !== secondStep) return [];
        return [
          {
            targetIndex,
            insertedChordId: `passing-dim-${context.tonic}-${rule.id}`,
            insertedSymbol: {
              rootOffset: rule.rootOffset,
              rootSpelling: { ...rule.rootSpelling },
              suffix: diminishedDefinition.symbol,
              definitionId: diminishedDefinition.id,
            },
            resizedPreviousDuration: split[0],
            insertedDuration: split[1],
            direction: firstStep,
            bassMotion: [1, 1],
            harmonicEffect: 'CHROMATIC_CONNECTOR',
            resolutionStrength: 4,
            priority,
            theorySources: [...rule.source, ...DIMINISHED_RULES.source],
          },
        ];
      },
    );
  },
};
