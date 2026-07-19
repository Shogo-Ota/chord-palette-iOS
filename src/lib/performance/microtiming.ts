/**
 * Microtiming layer (design §4 "Microtiming"): timing offsets are NOT independent
 * per note. Each bar draws a single shared "feel" (the kick's push/pull) and every
 * track's offset is that feel plus a bounded, track-specific jitter — so Bass stays
 * within ±4ms of the kick, Hat sits −6..+4ms, Snare lays back +4..+14ms, and the
 * whole kit moves together.
 *
 * Bar-boundary drift = 0: the first step of every bar gets exactly 0 offset, and
 * offsets are computed from the absolute grid position (never chained off the
 * previous note), so error can never accumulate across bars or loops.
 */

import { streamFor } from './rng';
import type { StylePreset } from './styles/types';
import type { TrackId } from './NoteEvent';

const MS_PER_MINUTE = 60000;

/** Convert a millisecond offset to a beat offset at the given tempo. */
export function msToBeat(ms: number, bpm: number): number {
  return (ms * bpm) / MS_PER_MINUTE;
}

/**
 * The shared per-bar timing feel (ms) — drawn once per bar from a kick-scoped
 * stream. This is the single source every track correlates to; because it is the
 * same value for all tracks in a bar, their offsets are correlated (not independent).
 */
export function barKickFeelMs(seed: number, bar: number, style: StylePreset): number {
  const rng = streamFor(seed, 'kickFeel', bar);
  return rng.range(style.kickFeelMs.min, style.kickFeelMs.max);
}

/**
 * Timing offset (ms) for a single hit. Step 0 of a bar always returns 0 (drift
 * reset). Otherwise it is the shared bar feel plus a bounded per-track jitter.
 */
export function trackOffsetMs(
  seed: number,
  bar: number,
  step: number,
  track: TrackId,
  style: StylePreset,
): number {
  if (step === 0) return 0; // bar-boundary drift reset — see file header
  const feel = barKickFeelMs(seed, bar, style);
  const range = style.microtiming[track];
  const jitter = streamFor(seed, 'micro', track, bar, step).range(range.min, range.max);
  return feel + jitter;
}
