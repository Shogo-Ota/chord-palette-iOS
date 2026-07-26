/**
 * Shuffle — 4/4 with a triplet hop. The bar is an 8th grid; the hop itself is the
 * `swing` ratio, which pushes every "&" toward the third triplet of the beat so the
 * two 8ths read long-short (blues / pop-rock). Bass holds the 1 & 3 pulse; the chord
 * mixes on-beats with the hopped offs.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const SHUFFLE: StylePreset = {
  id: 'shuffle',
  displayName: 'Shuffle',
  beatsPerBar: 4,
  stepsPerBar: 8,
  // On-beats plus the hopped "&" of 2 and 4 — the classic shuffle stab.
  chord: {
    hits: [X, o, X, X, X, o, X, X],
    accent: [1.0, 0.4, 0.7, 0.55, 0.9, 0.4, 0.7, 0.55],
  },
  // Root on 1 & 3; a light "&-of-4" walks into the next bar.
  bass: {
    hits: [X, o, o, o, X, o, o, X],
    accent: [1.0, 0.4, 0.4, 0.4, 0.88, 0.4, 0.4, 0.58],
  },
  kick: {
    hits: [X, o, o, o, X, o, o, o],
    accent: [1.0, 0.4, 0.4, 0.4, 0.9, 0.4, 0.4, 0.4],
  },
  snare: {
    hits: [o, o, X, o, o, o, X, o],
    accent: [0.4, 0.4, 0.95, 0.4, 0.4, 0.4, 0.95, 0.4],
  },
  hat: {
    hits: [X, X, X, X, X, X, X, X],
    accent: [0.75, 0.4, 0.65, 0.4, 0.72, 0.4, 0.65, 0.4],
    ghost: [o, X, o, X, o, X, o, X],
  },
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -5, max: 4 },
    snare: { min: 3, max: 12 },
    chord: { min: -3, max: 4 },
  },
  velocity: {
    center: { chord: 76, bass: 88, kick: 100, snare: 96, hat: 64 },
    accentDepth: 34,
    phraseDepth: 7,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 22,
    ghostMax: 42,
  },
  gate: { min: 0.7, max: 0.9, sustain: 'normal' },
  roundRobin: 4,
  // Triplet hop: the "&" sits at 2/3 of the beat (long-short ≈ 2:1).
  swing: { offbeatRatio: 0.667 },
  anticipation: { maxLeadBeats: 0.5 },
};
