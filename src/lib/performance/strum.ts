/**
 * Strum / roll (design "aesthetic: strum time"). A human never lands every note of a
 * block chord at the same instant — the hand rolls across the keys over a few
 * milliseconds. These pure helpers turn a {@link StrumSpec} into a per-note onset
 * offset (in BEATS) and a velocity scale, so {@link PerformanceEngine} can spread a
 * block chord's body notes into a natural roll.
 *
 * Determinism: the only randomness is the caller-supplied seeded {@link Rng}
 * (`streamFor(seed, …)`), never `Math.random` — same seed ⇒ same roll. Pure,
 * UI/RN/Expo/native-independent.
 */

import { msToBeat } from './microtiming';
import type { Rng } from './rng';
import type { StrumSpec } from './styles/types';

/**
 * Resolve the effective 0-based position of a note within the roll, honoring the
 * spec's direction. `rank` is the note's index in ASCENDING pitch order.
 *  - `up`        : low note first (rank as-is).
 *  - `down`      : high note first (reversed).
 *  - `alternate` : up on even strikes, down on odd (uses `strikeIndex` parity) so
 *                  successive chords roll in opposite directions like a real player.
 */
function effectiveRank(rank: number, size: number, spec: StrumSpec, strikeIndex: number): number {
  const down = spec.direction === 'down' || (spec.direction === 'alternate' && strikeIndex % 2 === 1);
  return down ? size - 1 - rank : rank;
}

/**
 * Onset offset (BEATS, always ≥ 0) for the note at `rank` within a `size`-note block
 * chord. The first note of the roll lands on the beat (offset 0); each later note is
 * pushed by an even share of `spreadMs` (tempo-scaled), plus optional seed jitter.
 *
 * The result is clamped to `[0, maxBeat]` so a roll can NEVER push a note past its own
 * window — safe for short (¼-bar) chords at fast tempi. Single-note chords (size ≤ 1)
 * always return 0.
 */
export function strumOffsetBeats(
  rank: number,
  size: number,
  spec: StrumSpec,
  bpm: number,
  rng: Rng,
  strikeIndex = 0,
  maxBeat = Number.POSITIVE_INFINITY,
): number {
  if (size <= 1 || spec.spreadMs <= 0) return 0;
  const eff = effectiveRank(rank, size, spec, strikeIndex);
  const step = spec.spreadMs / (size - 1);
  let ms = eff * step;
  if (spec.humanizeMs && spec.humanizeMs > 0) {
    ms += rng.range(-spec.humanizeMs, spec.humanizeMs);
  }
  if (ms < 0) ms = 0; // the roll only ever moves forward off the beat
  const beat = msToBeat(ms, bpm);
  return Math.min(Math.max(0, maxBeat), beat);
}

/**
 * Velocity multiplier (0..1] for the note at `rank`: later notes in the roll soften by
 * up to `velocityFalloff`. Returns 1 when no falloff / single note.
 */
export function strumVelocityScale(
  rank: number,
  size: number,
  spec: StrumSpec,
  strikeIndex = 0,
): number {
  const falloff = spec.velocityFalloff ?? 0;
  if (size <= 1 || falloff <= 0) return 1;
  const eff = effectiveRank(rank, size, spec, strikeIndex);
  return 1 - falloff * (eff / (size - 1));
}
