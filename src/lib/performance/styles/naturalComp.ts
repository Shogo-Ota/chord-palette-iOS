/**
 * Natural-feel chord comp, distilled from
 * `docs/midi-references/Good_Song_Chords_Top_10.mid` (ch0 piano, ~199 bars).
 *
 * Learning target was **attack timing only** (not key / melody / chord choice):
 *  - Chord body: straight quarters on beats 1–4 (aggregate bodyHeat ≥ 30% on
 *    16th steps 0/4/8/12).
 *  - Bass: off-beat eighths (&) — the walking &s that dominate the reference
 *    (16th steps 2/6/10/14).
 *  - Gate ≈ 0.5 so each body stab lasts ~½ beat (matches median body duration).
 *
 * Used exclusively by the Natural Feel; Driving still uses syncopated 8/16 bases.
 */

import type { StylePreset } from './types';

export const NATURAL_COMP: StylePreset = {
  id: 'naturalComp',
  displayName: 'Natural Comp',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th grid; quarters land on even steps
  // Straight quarter-note block chords (Good Song Top 10 aggregate).
  // Beat 2 is the strongest hit in the reference heat map; beat 1 a touch softer.
  chord: {
    hits: [true, false, true, false, true, false, true, false],
    accent: [0.9, 0.5, 1.0, 0.5, 0.95, 0.5, 0.92, 0.5],
  },
  // Walking &s under the chords — never locks to the chord downbeats.
  bass: {
    hits: [false, true, false, true, false, true, false, true],
    accent: [0.5, 0.72, 0.5, 0.7, 0.5, 0.7, 0.5, 0.82],
  },
  // Drum skeleton unused while PE drums:false; kept coherent for completeness.
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
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -6, max: 4 },
    snare: { min: 4, max: 14 },
    chord: { min: -3, max: 3 },
  },
  velocity: {
    center: { chord: 84, bass: 86, kick: 104, snare: 98, hat: 66 },
    accentDepth: 28,
    phraseDepth: 6,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  // ~½-beat body stabs on a 1-beat grid (matches MIDI median body duration ≈ 0.5).
  gate: { min: 0.45, max: 0.55, sustain: 'normal' },
  roundRobin: 4,
  // Subtle upward roll (~14ms) so block chords are "played by hands", not machine
  // stabs — the downbeat note still lands on the grid; upper voices trail a hair.
  strum: { spreadMs: 14, direction: 'up', humanizeMs: 3, velocityFalloff: 0.12 },
  // Reference comps are mostly on-grid; leave anticipation to Driving.
};
