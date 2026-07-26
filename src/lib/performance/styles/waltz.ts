/**
 * Waltz — 3/4, "oom-pah-pah". Bass on beat 1; chord stabs on 2 and 3, softer than
 * the downbeat so the pattern reads clearly. An 8th-note grid (6 steps) keeps the
 * pahs on exact beat heads.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const WALTZ: StylePreset = {
  id: 'waltz',
  displayName: 'Waltz',
  beatsPerBar: 3,
  stepsPerBar: 6,
  // Soft pahs on beats 2 and 3 (steps 2 and 4).
  chord: {
    hits: [o, o, X, o, X, o],
    accent: [0.4, 0.4, 0.7, 0.4, 0.65, 0.4],
  },
  // Oom on beat 1 only — the floor the pahs answer.
  bass: {
    hits: [X, o, o, o, o, o],
    accent: [1.0, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  kick: {
    hits: [X, o, o, o, o, o],
    accent: [0.95, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  snare: {
    hits: [o, o, X, o, X, o],
    accent: [0.4, 0.4, 0.55, 0.4, 0.5, 0.4],
  },
  hat: {
    hits: [X, o, X, o, X, o],
    accent: [0.55, 0.35, 0.45, 0.35, 0.45, 0.35],
  },
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -5, max: 4 },
    snare: { min: 2, max: 10 },
    chord: { min: -3, max: 4 },
  },
  velocity: {
    center: { chord: 68, bass: 86, kick: 92, snare: 70, hat: 52 },
    accentDepth: 28,
    phraseDepth: 6,
    humanizeMin: 4,
    humanizeMax: 6,
    ghostMin: 20,
    ghostMax: 38,
  },
  gate: {
    min: 0.45,
    max: 0.7,
    sustain: 'normal',
    byTrack: { bass: { min: 0.75, max: 0.95 } },
  },
  roundRobin: 3,
};
