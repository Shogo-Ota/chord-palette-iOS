/**
 * 8-Beat groove (pairs with the existing `eightBeat` accompaniment / `pop8` drum
 * feel). Straight 8ths: chord comps on the quarters, kick on 1 & 3, snare backbeat
 * on 2 & 4, hats on every 8th with ghosted off-beats.
 */

import type { StylePreset } from './types';

export const EIGHT_BEAT: StylePreset = {
  id: 'eightBeat',
  displayName: '8 Beat',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th-note grid
  // Comp on the four quarter notes; downbeat strongest, beat 3 next.
  chord: {
    hits: [true, false, true, false, true, false, true, false],
    accent: [1.0, 0.5, 0.7, 0.5, 0.85, 0.5, 0.7, 0.5],
  },
  // Bass roots track the kick (1 & 3) with a passing 8th before beat 3.
  bass: {
    hits: [true, false, false, true, true, false, false, false],
    accent: [1.0, 0.5, 0.5, 0.6, 0.85, 0.5, 0.5, 0.5],
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
    accentDepth: 34,
    phraseDepth: 7,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  gate: { min: 0.72, max: 0.95, sustain: 'normal' },
  roundRobin: 4,
};
