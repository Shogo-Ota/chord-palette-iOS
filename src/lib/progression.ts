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

/** Outcome of appending a stored progression onto the current one. */
export type AppendResult = {
  /** Merged progression (current + the head of `incoming` that fits the cap). */
  events: ChordEvent[];
  /** How many incoming chords were appended. */
  appended: number;
  /** How many incoming chords were dropped because they'd exceed the 16-bar cap. */
  dropped: number;
};

/**
 * Append `incoming` onto the tail of `current`, taking chords in order until the
 * next one would exceed the 16-bar cap; the remainder is dropped (kept contiguous
 * — we never leave a gap by skipping a big chord to fit a later small one). Pure;
 * ids are assumed already assigned by the caller.
 */
export function appendWithinCap(current: ChordEvent[], incoming: ChordEvent[]): AppendResult {
  const events = [...current];
  let appended = 0;
  for (let i = 0; i < incoming.length; i += 1) {
    const ev = incoming[i];
    if (!canAdd(events, ev.durationBeats)) {
      return { events, appended, dropped: incoming.length - appended };
    }
    events.push(ev);
    appended += 1;
  }
  return { events, appended, dropped: 0 };
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

/**
 * Progression-card index sounding at absolute `beat` (timeline from the head).
 * Used by the editor playhead — native `chordIndex` indexes PE note events, not
 * cards, so UI must derive the card from `beat` instead.
 * Returns -1 when empty or `beat` is before the first chord.
 */
export function chordIndexAtBeat(
  progression: Pick<ChordEvent, 'durationBeats'>[],
  beat: number,
): number {
  if (progression.length === 0 || !Number.isFinite(beat) || beat < 0) return -1;
  let cursor = 0;
  for (let i = 0; i < progression.length; i++) {
    const end = cursor + progression[i].durationBeats;
    // Half-open [start, end); last chord also catches an exact end-of-loop beat.
    if (beat < end || (i === progression.length - 1 && beat <= end + 1e-9)) return i;
    cursor = end;
  }
  return progression.length - 1;
}
