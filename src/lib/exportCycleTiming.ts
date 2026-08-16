import { remeterScale } from '@/lib/performance/meter';
import type { ChordEvent } from '@/types';

/** Convert an authoritative performance length to wall-clock seconds. */
export function cycleDurationSec(totalBeats: number, bpm: number): number {
  if (!Number.isFinite(totalBeats) || totalBeats <= 0) return 0;
  const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 1;
  return (totalBeats * 60) / safeBpm;
}

/**
 * Exact duration of one progression pass after the authoring 4/4 beat lengths are
 * mapped into the selected rhythm's meter.
 */
export function progressionCycleDurationSec(
  progression: readonly Pick<ChordEvent, 'durationBeats'>[],
  bpm: number,
  beatsPerBar: number = 4,
): number {
  const authoringBeats = progression.reduce(
    (sum, chord) => sum + Math.max(0, chord.durationBeats),
    0,
  );
  return cycleDurationSec(authoringBeats * remeterScale(beatsPerBar), bpm);
}
