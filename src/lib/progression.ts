import type { ChordDuration, ChordEvent } from '@/types';

/** 4/4 time — beats per bar (the MVP only supports 4/4). */
export const BEATS_PER_BAR = 4;
/** Hard cap on progression length (requirements §6: max 16 bars). */
export const MAX_BARS = 16;

/** Total length of a progression in beats. */
export function totalBeats(progression: ChordEvent[]): number {
  return progression.reduce((sum, e) => sum + e.durationBeats, 0);
}

/** Total length of a progression in bars (may be fractional). */
export function totalBars(progression: ChordEvent[]): number {
  return totalBeats(progression) / BEATS_PER_BAR;
}

/** Whether a chord of the given duration can be appended without exceeding 16 bars. */
export function canAdd(progression: ChordEvent[], durationBeats: ChordDuration): boolean {
  return totalBars(progression) + durationBeats / BEATS_PER_BAR <= MAX_BARS;
}

/**
 * Whether the event at `index` can be re-sized to `beats` without pushing the
 * progression over the 16-bar cap (shrinking is always allowed).
 */
export function canSetDuration(
  progression: ChordEvent[],
  index: number,
  beats: ChordDuration,
): boolean {
  if (index < 0 || index >= progression.length) return false;
  const delta = beats - progression[index].durationBeats;
  if (delta <= 0) return true;
  return totalBeats(progression) + delta <= MAX_BARS * BEATS_PER_BAR;
}

/** Short label for a chord duration, e.g. 4→"1小節", 2→"1/2", 1→"1/4". */
export function durationLabel(beats: ChordDuration): string {
  return beats === 4 ? '1小節' : beats === 2 ? '1/2' : '1/4';
}
