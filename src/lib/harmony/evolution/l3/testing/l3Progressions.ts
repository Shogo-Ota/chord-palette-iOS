import type { KeyMode, MajorKey } from '@/types';

import { seventhProgression } from '../../testing/l2Progressions';
import { triadProgression } from '../../testing/phase1Progressions';
import type { EvolutionChord, EvolutionContext, EvolutionScope } from '../../types';

export const L3_GOLDEN_PROGRESSIONS = {
  secondaryDominant: triadProgression('C', 'major', [0, 5]),
  passingDiminished: triadProgression('C', 'major', [0, 1, 4]),
  tritoneSubstitution: seventhProgression('C', 'major', [4, 0]),
} as const satisfies Readonly<Record<string, readonly EvolutionChord[]>>;

export function l3Context(
  progression: readonly EvolutionChord[],
  options: {
    readonly tonic?: MajorKey;
    readonly mode?: KeyMode;
    readonly scope?: EvolutionScope;
  } = {},
): EvolutionContext {
  return {
    tonic: options.tonic ?? 'C',
    mode: options.mode ?? 'major',
    progression,
    scope: options.scope ?? { kind: 'progression' },
    level: 'reharm',
  };
}
