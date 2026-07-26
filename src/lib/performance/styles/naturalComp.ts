/**
 * Natural-feel chord comp.
 *
 * The rhythm is distilled from `docs/midi-references/Good_Song_Chords_Top_10.mid`
 * (ch0 piano, ~199 bars) — attack timing only, never key / melody / chord choice:
 *  - Chord body: straight quarters on beats 1–4 (aggregate bodyHeat ≥ 30% on
 *    16th steps 0/4/8/12).
 *  - Bass: off-beat eighths (&) — the walking &s that dominate the reference
 *    (16th steps 2/6/10/14).
 *
 * The *dynamics* follow GT-001 instead (see `../groundTruth.ts`), the owner's
 * reference performance and the final arbiter of feel: quiet, nearly flat in
 * accent, tightly rolled, short-noted and on the grid. Where a number below is
 * derived rather than chosen, it is computed from `GT_001` so re-running the
 * analyzer surfaces the difference instead of leaving a stale constant behind.
 *
 * Used exclusively by the Natural Feel; the Sparse and Dense bank variants inherit
 * everything here except their bass rhythm. Driving and Relaxed are unaffected.
 */

import { GT_001 } from '../groundTruth';
import type { StepPattern, StylePreset } from './types';

// Straight quarter-note block chords (Good Song Top 10 aggregate).
// Beat 2 is the strongest hit in the reference heat map; beat 1 a touch softer.
const CHORD_PATTERN: StepPattern = {
  hits: [true, false, true, false, true, false, true, false],
  accent: [0.9, 0.5, 1.0, 0.5, 0.95, 0.5, 0.92, 0.5],
};

// Walking &s under the chords — never locks to the chord downbeats.
const BASS_PATTERN: StepPattern = {
  hits: [false, true, false, true, false, true, false, true],
  accent: [0.5, 0.72, 0.5, 0.7, 0.5, 0.7, 0.5, 0.82],
};

/**
 * GT-001 separates its metrical roles by only ~4.5 MIDI units, so the accent term
 * stays shallow — a deep one would read as a machine emphasising the grid.
 */
const ACCENT_DEPTH = 10;

/** Mean accent across a pattern's hits — what the accent term contributes typically. */
function meanHitAccent(p: StepPattern): number {
  const hit = p.accent.filter((_, i) => p.hits[i]);
  return hit.reduce((a, b) => a + b, 0) / hit.length;
}

/**
 * The center that lands a track's typical note on `targetVelocity`, given how much
 * the accent term already contributes (`computeVelocity`: `(accent - 0.6) * depth`).
 */
function centerFor(targetVelocity: number, pattern: StepPattern): number {
  return Math.round(targetVelocity - (meanHitAccent(pattern) - 0.6) * ACCENT_DEPTH);
}

export const NATURAL_COMP: StylePreset = {
  id: 'naturalComp',
  displayName: 'Natural Comp',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th grid; quarters land on even steps
  chord: CHORD_PATTERN,
  bass: BASS_PATTERN,
  // Drum skeleton unused while PE drums:false; kept coherent for completeness.
  // GT-001 is a piano performance, so it says nothing about drum dynamics.
  kick: {
    hits: [true, false, false, false, true, false, false, false],
    accent: [1.0, 0.5, 0.5, 0.5, 0.9, 0.5, 0.5, 0.5],
  },
  snare: {
    hits: [false, false, true, false, false, false, true, false],
    accent: [0.5, 0.5, 0.95, 0.5, 0.5, 0.5, 0.95, 0.5],
  },
  hat: {
    hits: [true, true, true, true, true, true, true, true],
    accent: [0.8, 0.45, 0.65, 0.45, 0.75, 0.45, 0.65, 0.45],
    ghost: [false, true, false, true, false, true, false, true],
  },
  // GT-001 is quantized (median onset deviation 0 ms), so the shared bar feel and
  // the comp's own jitter both stay inside a couple of milliseconds.
  kickFeelMs: { min: -2, max: 2 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -6, max: 4 },
    snare: { min: 4, max: 14 },
    chord: { min: -2, max: 2 },
  },
  velocity: {
    // Chord quarters play GT-001's downbeats; the walking bass plays its &s.
    center: {
      chord: centerFor(GT_001.velocity.downbeat, CHORD_PATTERN),
      bass: centerFor(GT_001.velocity.upbeat, BASS_PATTERN),
      kick: 104,
      snare: 98,
      hat: 66,
    },
    accentDepth: ACCENT_DEPTH,
    // GT-001 holds a narrow band (p25 64 … p75 79), so the phrase arc stays gentle.
    phraseDepth: 4,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  // GT-001's mid-register notes run 0.21 … 0.50 beats (median 0.30) — short stabs
  // on this 1-beat grid, with the reference's own spread rather than a fixed length.
  gate: { min: 0.21, max: 0.5, sustain: 'normal' },
  roundRobin: 4,
  // GT-001 rolls its block chords over ~6.5 ms at most (median 0), far tighter than
  // a strummed feel: audible as "played by hands", not as a spread.
  strum: { spreadMs: 7, direction: 'up', humanizeMs: 2, velocityFalloff: 0.12 },
  // Reference comps are mostly on-grid; leave anticipation to Driving.
};
