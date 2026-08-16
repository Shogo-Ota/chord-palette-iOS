/**
 * Ballad groove (slow, sustained — conceptually the `block` accompaniment feel).
 * Chords are held (legato) rather than re-struck busily; gentle kick on 1, soft
 * backbeat snare on 3, and quarter-note hats. Velocities sit lower and softer.
 */

import type { StylePreset } from './types';

export const BALLAD: StylePreset = {
  id: 'ballad',
  displayName: 'Ballad',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th grid, but mostly sustained
  // One sustained chord per half-bar so the harmony rings (legato).
  chord: {
    hits: [true, false, false, false, true, false, false, false],
    accent: [0.9, 0.4, 0.4, 0.4, 0.7, 0.4, 0.4, 0.4],
  },
  bass: {
    hits: [true, false, false, false, true, false, false, false],
    accent: [0.9, 0.4, 0.4, 0.4, 0.7, 0.4, 0.4, 0.4],
  },
  kick: {
    hits: [true, false, false, false, false, false, false, false],
    accent: [0.85, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  // Soft backbeat on beat 3 (step 4) only — restrained for a ballad.
  snare: {
    hits: [false, false, false, false, true, false, false, false],
    accent: [0.4, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.4],
  },
  // Quarter-note hats, quiet.
  hat: {
    hits: [true, false, true, false, true, false, true, false],
    accent: [0.6, 0.4, 0.5, 0.4, 0.6, 0.4, 0.5, 0.4],
  },
  kickFeelMs: { min: -4, max: 4 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -6, max: 4 },
    snare: { min: 4, max: 14 },
    chord: { min: -4, max: 4 },
  },
  velocity: {
    center: { chord: 68, bass: 72, kick: 86, snare: 80, hat: 54 },
    // v1.01 listen pass: slightly more contour so chords don't sit under the bass.
    accentDepth: 30,
    phraseDepth: 8,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 40,
  },
  // Sustained/legato: higher gate floor so notes ring into each other.
  gate: { min: 0.8, max: 0.95, sustain: 'legato' },
  roundRobin: 3,
};
