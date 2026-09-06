import type { EvolutionChord, EvolutionScope } from '../types';

export function copyEvolutionChord(chord: EvolutionChord): EvolutionChord {
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

export function copyEvolutionScope(scope: EvolutionScope): EvolutionScope {
  return scope.kind === 'chord' ? { kind: 'chord', index: scope.index } : { kind: 'progression' };
}
