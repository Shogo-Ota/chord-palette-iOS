/**
 * Block groove (pairs with the `block` accompaniment). The simplest possible comp:
 * every chord tone is struck ONCE on the chord downbeat and held for that chord's
 * length. No human-template figuration, no re-strikes, no anticipation, no arpeggio.
 * Bass plants the root on beat 1 and sustains under it.
 */

import type { StylePreset } from './types';

export const BLOCK: StylePreset = {
  id: 'block',
  displayName: 'Block',
  beatsPerBar: 4,
  stepsPerBar: 8, // 8th grid, but the chord lands once on beat 1
  holdAllChordTones: true,
  // One block chord per bar on the downbeat; held (legato) so the harmony rings.
  chord: {
    hits: [true, false, false, false, false, false, false, false],
    accent: [1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  },
  // Bass plants the root once on beat 1 and sustains — grounded and square.
  bass: {
    hits: [true, false, false, false, false, false, false, false],
    accent: [1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  },
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
    chord: { min: -4, max: 4 },
  },
  velocity: {
    center: { chord: 80, bass: 88, kick: 104, snare: 98, hat: 66 },
    accentDepth: 32,
    phraseDepth: 7,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  // Long ring: high gate floor + legato so the single per-bar chord sustains and
  // decays into the next bar rather than being re-struck.
  gate: { min: 0.9, max: 0.98, sustain: 'legato' },
  roundRobin: 4,
};
