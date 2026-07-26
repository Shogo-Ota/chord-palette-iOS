/**
 * Reggae — 4/4 with the skank on 2 & 4. Bass owns the downbeats; the chord is a
 * short stab on the backbeat so the offbeat is unmistakable. Gate stays short on
 * the comps — a long ring would wash out the skank.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const REGGAE: StylePreset = {
  id: 'reggae',
  displayName: 'Reggae',
  beatsPerBar: 4,
  stepsPerBar: 8,
  // Skank on 2 & 4 (and a lighter &-of-2 / &-of-4 echo so the offbeat breathes).
  chord: {
    hits: [o, o, X, X, o, o, X, X],
    accent: [0.4, 0.4, 0.95, 0.55, 0.4, 0.4, 0.92, 0.55],
  },
  // Downbeat bass; a light "&-of-4" pulls into the next bar without stealing the skank.
  bass: {
    hits: [X, o, o, o, X, o, o, X],
    accent: [1.0, 0.4, 0.4, 0.4, 0.9, 0.4, 0.4, 0.6],
  },
  kick: {
    hits: [X, o, o, o, X, o, o, o],
    accent: [1.0, 0.4, 0.4, 0.4, 0.85, 0.4, 0.4, 0.4],
  },
  snare: {
    hits: [o, o, o, o, o, o, o, o],
    accent: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  hat: {
    hits: [o, o, X, o, o, o, X, o],
    accent: [0.4, 0.4, 0.7, 0.4, 0.4, 0.4, 0.7, 0.4],
  },
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -4, max: 4 },
    snare: { min: 0, max: 4 },
    chord: { min: -2, max: 3 },
  },
  velocity: {
    center: { chord: 72, bass: 90, kick: 98, snare: 70, hat: 56 },
    accentDepth: 32,
    phraseDepth: 6,
    humanizeMin: 4,
    humanizeMax: 6,
    ghostMin: 20,
    ghostMax: 38,
  },
  // Short comps — the silence after the skank is the groove.
  gate: { min: 0.22, max: 0.4, sustain: 'staccato' },
  roundRobin: 4,
};
