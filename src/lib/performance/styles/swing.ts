/**
 * Swing — 4/4, softer and more jazz-leaning than Shuffle. Bass walks the quarter
 * pulse; the chord lives on the offs so the hop is heard against a steady floor.
 * The swing ratio is gentler than Shuffle's triplet (closer to a soft long-short),
 * and the Variation layer is what keeps every bar from reading the same.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const SWING: StylePreset = {
  id: 'swing',
  displayName: 'Swing',
  beatsPerBar: 4,
  stepsPerBar: 8,
  // Off-beats carry the harmony; beat 1 gets a light landing so the bar has a head.
  chord: {
    hits: [X, X, o, X, o, X, o, X],
    accent: [0.75, 0.62, 0.4, 0.7, 0.4, 0.65, 0.4, 0.68],
  },
  // Walking quarters — the pulse the hopped comps lean against.
  bass: {
    hits: [X, o, X, o, X, o, X, o],
    accent: [1.0, 0.4, 0.78, 0.4, 0.88, 0.4, 0.75, 0.4],
  },
  kick: {
    hits: [X, o, o, o, X, o, o, o],
    accent: [0.9, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.4],
  },
  snare: {
    hits: [o, o, X, o, o, o, X, o],
    accent: [0.4, 0.4, 0.85, 0.4, 0.4, 0.4, 0.85, 0.4],
  },
  hat: {
    hits: [X, X, X, X, X, X, X, X],
    accent: [0.7, 0.38, 0.58, 0.38, 0.66, 0.38, 0.58, 0.38],
    ghost: [o, X, o, X, o, X, o, X],
  },
  kickFeelMs: { min: -4, max: 4 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -1, max: 3 },
    hat: { min: -6, max: 5 },
    snare: { min: 2, max: 12 },
    // Laid a touch behind the beat — jazz-comp feel.
    chord: { min: 1, max: 8 },
  },
  velocity: {
    center: { chord: 70, bass: 82, kick: 92, snare: 88, hat: 58 },
    accentDepth: 28,
    phraseDepth: 8,
    humanizeMin: 5,
    humanizeMax: 8,
    ghostMin: 20,
    ghostMax: 40,
  },
  gate: { min: 0.72, max: 0.92, sustain: 'normal' },
  roundRobin: 4,
  // Softer than Shuffle's 2:1 — closer to a gentle long-short.
  swing: { offbeatRatio: 0.62 },
};
