import type {
  EvolutionRule,
  EvolutionRuleApplication,
  TechniqueSupportResult,
} from '../../contracts';
import { copyEvolutionChord } from '../chordCopies';

export const TRITONE_SUBSTITUTION_RULE_ID = 'l3-tritone-substitution';

const MODE_SUPPORT = {
  major: 'SUPPORTED',
  minor: 'UNSUPPORTED',
} as const;

export const tritoneSubstitutionRule: EvolutionRule = {
  id: TRITONE_SUBSTITUTION_RULE_ID,
  technique: 'tritone_substitute',
  level: 'reharm',
  modeSupport: MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const resolutions =
      dependencies.tritoneSubstitution?.resolveTritoneSubstitutions(context, targetIndex) ?? [];
    return resolutions.length > 0
      ? { status: 'SUPPORTED', eligible: true, reason: 'ELIGIBLE' }
      : {
          status: MODE_SUPPORT[context.mode],
          eligible: false,
          reason:
            targetIndex >= 0 && targetIndex < context.progression.length
              ? 'CHORD_NOT_ELIGIBLE'
              : 'TARGET_OUT_OF_RANGE',
        };
  },

  generate(context, dominantIndex, dependencies): readonly EvolutionRuleApplication[] {
    const dominant = context.progression[dominantIndex];
    if (!dominant || !dependencies.tritoneSubstitution) return [];

    return dependencies.tritoneSubstitution
      .resolveTritoneSubstitutions(context, dominantIndex)
      .map((resolution) => ({
        change: {
          kind: 'replace' as const,
          index: dominantIndex,
          before: copyEvolutionChord(dominant),
          after: {
            ...copyEvolutionChord(dominant),
            chordId: resolution.targetChordId,
            symbol: {
              ...resolution.targetSymbol,
              rootSpelling: resolution.targetSymbol.rootSpelling
                ? { ...resolution.targetSymbol.rootSpelling }
                : undefined,
            },
          },
        },
        priority: resolution.priority,
        theorySources: resolution.theorySources,
      }));
  },
};
