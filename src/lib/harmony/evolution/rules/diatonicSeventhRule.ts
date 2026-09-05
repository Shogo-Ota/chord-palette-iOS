import type { EvolutionRule, EvolutionRuleApplication, TechniqueSupportResult } from '../contracts';
import type { EvolutionChord } from '../types';

export const DIATONIC_SEVENTH_RULE_ID = 'diatonic-seventh';

const DIATONIC_SEVENTH_MODE_SUPPORT = {
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

/**
 * Converts only the triad explicitly assigned to a diatonic degree into that
 * degree's seventh chord. It does not interpret an arbitrary dim/sus/aug chord
 * as eligible and never infers a local key from surrounding chord roots.
 */
export const diatonicSeventhRule: EvolutionRule = {
  id: DIATONIC_SEVENTH_RULE_ID,
  technique: 'add_seventh',
  level: 'seventh',
  modeSupport: DIATONIC_SEVENTH_MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const chord = context.progression[targetIndex];
    if (!chord) {
      return {
        status: DIATONIC_SEVENTH_MODE_SUPPORT[context.mode],
        eligible: false,
        reason: 'TARGET_OUT_OF_RANGE',
      };
    }
    const resolution = dependencies.theory.resolveDiatonicSeventh(context, chord);
    return resolution
      ? { status: 'SUPPORTED', eligible: true, reason: 'ELIGIBLE' }
      : {
          status: DIATONIC_SEVENTH_MODE_SUPPORT[context.mode],
          eligible: false,
          reason: 'CHORD_NOT_ELIGIBLE',
        };
  },

  generate(context, targetIndex, dependencies): readonly EvolutionRuleApplication[] {
    const chord = context.progression[targetIndex];
    if (!chord) return [];
    const resolution = dependencies.theory.resolveDiatonicSeventh(context, chord);
    if (!resolution) return [];

    const before = copyChord(chord);
    const after: EvolutionChord = {
      ...copyChord(chord),
      chordId: resolution.targetChordId,
      symbol: {
        ...resolution.targetSymbol,
        ...(resolution.targetSymbol.rootSpelling
          ? { rootSpelling: { ...resolution.targetSymbol.rootSpelling } }
          : {}),
      },
    };
    return [
      {
        change: {
          kind: 'replace',
          index: targetIndex,
          before,
          after,
        },
        theorySources: resolution.theorySources,
      },
    ];
  },
};
