/**
 * Round-robin layer (design §4 "Round Robin"): for each major register band ×
 * velocity layer, choose among ≥3 sample variants, avoiding the same index twice in
 * a row, reproducibly from the seed. This removes the "machine-gun" repeated-sample
 * artefact.
 *
 * The picker keeps a per-(track, band, layer) memory of the last index used, so
 * consecutive notes in the same pool never repeat while different pools stay
 * independent. All choices come from a seeded stream (never `Math.random`).
 */

import { streamFor } from './rng';
import type { TrackId } from './NoteEvent';

/** Coarse register band of a MIDI pitch (one band per octave). */
export function registerBand(pitch: number): number {
  return Math.floor(pitch / 12);
}

/** Velocity layer index: 0 = soft, 1 = medium, 2 = hard (design's 3-layer split). */
export function velocityLayer(velocity: number): number {
  if (velocity < 50) return 0;
  if (velocity < 90) return 1;
  return 2;
}

/**
 * Stateful, deterministic round-robin selector. Construct once per performance and
 * call {@link RoundRobinPicker.next} per note in emission order.
 */
export class RoundRobinPicker {
  private readonly last = new Map<string, number>();
  private readonly counter = new Map<string, number>();

  constructor(
    private readonly seed: number,
    private readonly poolSize: number,
  ) {}

  /** Next round-robin index for a note, avoiding an immediate repeat within its pool. */
  next(track: TrackId, pitch: number, velocity: number): number {
    if (this.poolSize <= 1) return 0;
    const key = `${track}:${registerBand(pitch)}:${velocityLayer(velocity)}`;
    const seq = this.counter.get(key) ?? 0;
    this.counter.set(key, seq + 1);

    const rng = streamFor(this.seed, 'rr', key, seq);
    let index = rng.int(0, this.poolSize - 1);
    const previous = this.last.get(key);
    if (previous !== undefined && index === previous) {
      // Deterministically rotate off the repeated index.
      index = (index + 1 + rng.int(0, this.poolSize - 2)) % this.poolSize;
    }
    this.last.set(key, index);
    return index;
  }
}
