import type { EvolutionRule, EvolutionRuleApplication, TechniqueSupportResult } from '../contracts';
import type { EvolutionChord } from '../types';

export const AVAILABLE_TENSION_RULE_ID = 'available-tension';

const MODE_SUPPORT = {
  major: 'SUPPORTED',
  minor: 'SUPPORTED',
} as const;

function copyChord(chord: EvolutionChord): EvolutionChord {
  return {
    ...chord,
    symbol: {
      ...chord.symbol,
      ...(chord.symbol.rootSpelling ? { rootSpelling: { ...chord.symbol.rootSpelling } } : {}),
    },
    ...(chord.localHarmonicContext
      ? { localHarmonicContext: { ...chord.localHarmonicContext } }
      : {}),
  };
}

export const availableTensionRule: EvolutionRule = {
  id: AVAILABLE_TENSION_RULE_ID,
  technique: 'add_tension',
  level: 'tension',
  modeSupport: MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const chord = context.progression[targetIndex];
    const resolutions =
      chord && dependencies.tension
        ? dependencies.tension.resolveAvailableTensions(context, chord)
        : [];
    return resolutions.length > 0
      ? { status: 'SUPPORTED', eligible: true, reason: 'ELIGIBLE' }
      : {
          status: MODE_SUPPORT[context.mode],
          eligible: false,
          reason: chord ? 'CHORD_NOT_ELIGIBLE' : 'TARGET_OUT_OF_RANGE',
        };
  },

  generate(context, targetIndex, dependencies): readonly EvolutionRuleApplication[] {
    const chord = context.progression[targetIndex];
    if (!chord || !dependencies.tension) return [];

    return dependencies.tension.resolveAvailableTensions(context, chord).map((resolution) => {
      const before = copyChord(chord);
      const after: EvolutionChord = {
        ...copyChord(chord),
        chordId: resolution.targetChordId,
        symbol: {
          ...resolution.targetSymbol,
          ...(resolution.targetSymbol.rootSpelling
            ? {
                rootSpelling: {
                  ...resolution.targetSymbol.rootSpelling,
                },
              }
            : {}),
        },
      };
      return {
        change: {
          kind: 'replace' as const,
          index: targetIndex,
          before,
          after,
        },
        priority: resolution.priority,
        theorySources: resolution.theorySources,
      };
    });
  },
};
