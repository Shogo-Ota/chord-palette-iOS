import { diatonicTriads, MAJOR_KEYS } from '@/data/music';
import type { ChordDuration, KeyMode, MajorKey } from '@/types';

import type {
  EvolutionChord,
  EvolutionContext,
  EvolutionScope,
  ExplicitLocalHarmonicContext,
} from '../types';

export const ALL_TONAL_CONTEXTS: readonly {
  tonic: MajorKey;
  mode: KeyMode;
}[] = MAJOR_KEYS.flatMap((tonic) => [
  { tonic, mode: 'major' as const },
  { tonic, mode: 'minor' as const },
]);

export const MAJOR_PROGRESSION_DEGREES_20: readonly (readonly number[])[] = [
  [0, 4, 5, 3],
  [1, 4, 0],
  [5, 3, 0, 4],
  [3, 4, 2, 5],
  [0, 5, 3, 4],
  [0, 3, 4, 0],
  [0, 4, 5, 2, 3, 0, 3, 4],
  [0, 2, 3, 4],
  [0, 6, 5, 4],
  [5, 1, 4, 0],
  [0, 3, 1, 4],
  [2, 5, 1, 4],
  [0, 5, 1, 4],
  [3, 0, 1, 4],
  [0, 4, 3, 4],
  [5, 4, 3, 4],
  [0, 1, 4, 0],
  [0, 2, 5, 3],
  [3, 4, 0, 5],
  [0, 6, 2, 5],
];

export function triadChord(
  tonic: MajorKey,
  mode: KeyMode,
  degreeIndex: number,
  options: {
    eventId?: string;
    durationBeats?: ChordDuration;
    localHarmonicContext?: ExplicitLocalHarmonicContext;
  } = {},
): EvolutionChord {
  const chord = diatonicTriads(tonic, mode)[degreeIndex];
  if (!chord) throw new Error(`Missing ${tonic} ${mode} degree ${degreeIndex}`);
  return {
    eventId: options.eventId ?? `event-${degreeIndex}`,
    chordId: chord.id,
    symbol: {
      rootOffset: chord.rootOffset,
      suffix: chord.suffix,
      definitionId: chord.definitionId,
    },
    function: chord.function,
    durationBeats: options.durationBeats ?? 4,
    ...(options.localHarmonicContext
      ? { localHarmonicContext: { ...options.localHarmonicContext } }
      : {}),
    voicingPosition: 'root',
  };
}

export function triadProgression(
  tonic: MajorKey,
  mode: KeyMode,
  degrees: readonly number[],
): readonly EvolutionChord[] {
  return degrees.map((degree, index) =>
    triadChord(tonic, mode, degree, { eventId: `event-${index}` }),
  );
}

export function evolutionContext(
  progression: readonly EvolutionChord[],
  options: {
    tonic?: MajorKey;
    mode?: KeyMode;
    scope?: EvolutionScope;
  } = {},
): EvolutionContext {
  return {
    tonic: options.tonic ?? 'C',
    mode: options.mode ?? 'major',
    progression,
    scope: options.scope ?? { kind: 'progression' },
    level: 'seventh',
  };
}
