/**
 * Velocity layer (design §4 "Velocity"): beat accent × 2/4-bar phrase curve ×
 * per-note humanize, with ghost notes at 20–45, and a hard guard against the
 * "machine-gun" artefact — no 5 identical velocities in a row.
 */

import { clampVelocity } from './NoteEvent';
import type { Rng } from './rng';
import type { StylePreset } from './styles/types';
import type { TrackId } from './NoteEvent';

/**
 * 2/4-bar phrase curve in [-1, 1]. A gentle swell that repeats every 4 bars so an
 * 8-bar loop does not feel like flat repetition (design §4 "phrase structure"). It
 * is purely structural (no randomness) so it stays deterministic.
 */
export function phraseCurve(bar: number): number {
  return Math.sin(((bar % 4) / 4) * 2 * Math.PI);
}

export interface VelocityParams {
  style: StylePreset;
  track: TrackId;
  /** 0..1 accent weight for this step (from the style's StepPattern). */
  accent: number;
  /** Bar index (drives the phrase curve). */
  bar: number;
  /** Whether this hit is a ghost note. */
  ghost: boolean;
  rng: Rng;
}

/** Resolve one note's MIDI velocity from accent, phrase position and humanize. */
export function computeVelocity(p: VelocityParams): number {
  const v = p.style.velocity;
  if (p.ghost) {
    return clampVelocity(p.rng.range(v.ghostMin, v.ghostMax));
  }
  const center = v.center[p.track];
  const accentTerm = (p.accent - 0.6) * v.accentDepth;
  const phraseTerm = phraseCurve(p.bar) * v.phraseDepth;
  const humanizeMag = p.rng.range(v.humanizeMin, v.humanizeMax);
  const humanize = (p.rng.bool() ? 1 : -1) * humanizeMag;
  return clampVelocity(center + accentTerm + phraseTerm + humanize);
}

/**
 * In-place guard: break any run of ≥5 identical velocities by nudging the offending
 * value by a deterministic ±1..3, guaranteeing it differs from its predecessor.
 * Applied per track over the emission-ordered velocity list.
 */
export function avoidFiveInARow(velocities: number[], rng: Rng): void {
  let run = 1;
  for (let i = 1; i < velocities.length; i++) {
    if (velocities[i] === velocities[i - 1]) {
      run++;
      if (run >= 5) {
        const delta = rng.int(1, 3) * (rng.bool() ? 1 : -1);
        let nudged = clampVelocity(velocities[i] + delta);
        if (nudged === velocities[i - 1]) {
          nudged = clampVelocity(velocities[i - 1] + (velocities[i - 1] > 1 ? -2 : 2));
        }
        velocities[i] = nudged;
        run = 1;
      }
    } else {
      run = 1;
    }
  }
}
