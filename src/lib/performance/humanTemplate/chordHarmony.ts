import { keyTonicPc, noteAt } from '@/data/music';
import { intervalsForChord } from '@/lib/theory/definitions';
import type { ChordEvent, MajorKey } from '@/types';

import type { ChordHarmonyInput } from '../strictV2';

export type { ChordHarmonyInput as PerfChordHarmony };

/** Build strict-v2 harmony input from a degree-based chord event. */
export function chordHarmonyFromEvent(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'definitionId' | 'bassOffset'>,
  key: MajorKey,
): ChordHarmonyInput {
  const tonic = keyTonicPc(key);
  const rootOffset = chord.rootOffset ?? 0;
  const rootPc = (tonic + rootOffset) % 12;
  const intervals = intervalsForChord(chord.suffix ?? '', chord.definitionId);
  const rootName = noteAt(key, rootOffset);
  const suffix = chord.suffix ?? '';
  const symbol = `${rootName}${suffix}`;
  const quality = suffix.includes('m') && !suffix.includes('maj') ? 'min' : 'maj';
  const slashBassPc =
    chord.bassOffset != null && chord.bassOffset !== rootOffset
      ? (tonic + chord.bassOffset) % 12
      : undefined;
  return {
    symbol,
    rootPc,
    quality,
    chordIntervals: intervals,
    slashBassPc,
  };
}
