/**
 * 8-Beat groove (pairs with the existing `eightBeat` accompaniment / `pop8` drum
 * feel). Modern-pop syncopated comp — NOT straight quarters (that flavour now lives
 * in the `block` style). The chord hits the classic "1 · &of2 · 3 · &of4" pattern so
 * the harmony breathes and pushes forward; kick on 1 & 3, snare backbeat on 2 & 4,
 * hats on every 8th with ghosted off-beats. Anticipation lets the &of4 stab pull the
 * next chord in early (the "食い" that makes the groove feel good).
 */

import type { StylePreset } from './types';

export const EIGHT_BEAT: StylePreset = {
  id: 'eightBeat',
  displayName: '8 Beat',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th-note grid
  // Syncopated pop comp: 1 (step0), &of2 (step3), 3 (step4), &of4 (step7).
  // Down-beats (1 & 3) are strongest; the two off-beat pushes sit just under them.
  // Band Engine v1 (band_engine_spec §11-1): the on/off contrast widened — beat 3
  // lifted, the off-beat pushes pulled slightly under — so the drive reads as
  // accent, not density.
  chord: {
    hits: [true, false, false, true, true, false, false, true],
    accent: [1.0, 0.5, 0.5, 0.66, 0.9, 0.5, 0.5, 0.7],
  },
  // Bass keeps its root feel on 1 & 3 and adds a light &of4 push into the next chord.
  bass: {
    hits: [true, false, false, false, true, false, false, true],
    accent: [1.0, 0.5, 0.5, 0.5, 0.85, 0.5, 0.5, 0.6],
  },
  kick: {
    hits: [true, false, false, false, true, false, false, false],
    accent: [1.0, 0.5, 0.5, 0.5, 0.9, 0.5, 0.5, 0.5],
  },
  snare: {
    hits: [false, false, true, false, false, false, true, false],
    accent: [0.5, 0.5, 0.95, 0.5, 0.5, 0.5, 0.95, 0.5],
  },
  // Hats on every 8th; off-beats are ghosted for a natural closed-hat feel.
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
    chord: { min: -4, max: 4 },
  },
  velocity: {
    center: { chord: 78, bass: 88, kick: 104, snare: 98, hat: 66 },
    // Band Engine v1: deeper accent range — the widened accents above land harder.
    accentDepth: 38,
    phraseDepth: 7,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  gate: { min: 0.72, max: 0.95, sustain: 'normal' },
  roundRobin: 4,
  // The off-beat stabs (&of2 / &of4) pull the next chord in a half-beat early.
  anticipation: { maxLeadBeats: 0.5 },
};
