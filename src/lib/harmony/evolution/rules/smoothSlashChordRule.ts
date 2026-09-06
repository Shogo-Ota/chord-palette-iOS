import type { EvolutionRule, EvolutionRuleApplication, TechniqueSupportResult } from '../contracts';
import type { EvolutionChord } from '../types';

export const SMOOTH_SLASH_CHORD_RULE_ID = 'smooth-slash-chord';

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

export const smoothSlashChordRule: EvolutionRule = {
  id: SMOOTH_SLASH_CHORD_RULE_ID,
  technique: 'slash_chord',
  level: 'tension',
  modeSupport: MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const chord = context.progression[targetIndex];
    const resolutions =
      chord && dependencies.slash
        ? dependencies.slash.resolveChordToneBassOptions(context, targetIndex)
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
    if (!chord || !dependencies.slash) return [];

    return dependencies.slash
      .resolveChordToneBassOptions(context, targetIndex)
      .map((resolution) => {
        const before = copyChord(chord);
        const after: EvolutionChord = {
          ...copyChord(chord),
          chordId: resolution.targetChordId,
          symbol: {
            ...chord.symbol,
            bassOffset: resolution.bassOffset,
            ...(chord.symbol.rootSpelling
              ? { rootSpelling: { ...chord.symbol.rootSpelling } }
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
