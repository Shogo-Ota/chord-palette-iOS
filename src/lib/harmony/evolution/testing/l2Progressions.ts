import { diatonicSevenths, MAJOR_KEYS } from '@/data/music';
import type { ChordDuration, KeyMode, MajorKey } from '@/types';

import type {
  EvolutionChord,
  EvolutionContext,
  EvolutionScope,
  ExplicitLocalHarmonicContext,
} from '../types';

export const ALL_L2_TONAL_CONTEXTS: readonly {
  tonic: MajorKey;
  mode: KeyMode;
}[] = MAJOR_KEYS.flatMap((tonic) => [
  { tonic, mode: 'major' as const },
  { tonic, mode: 'minor' as const },
]);

export function seventhChord(
  tonic: MajorKey,
  mode: KeyMode,
  degreeIndex: number,
  options: {
    eventId?: string;
    durationBeats?: ChordDuration;
    localHarmonicContext?: ExplicitLocalHarmonicContext;
  } = {},
): EvolutionChord {
  const chord = diatonicSevenths(tonic, mode)[degreeIndex];
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

export function seventhProgression(
  tonic: MajorKey,
  mode: KeyMode,
  degrees: readonly number[],
): readonly EvolutionChord[] {
  return degrees.map((degree, index) =>
    seventhChord(tonic, mode, degree, { eventId: `event-${index}` }),
  );
}

export function l2Context(
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
    level: 'tension',
  };
}
