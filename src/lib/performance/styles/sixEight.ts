/**
 * 6/8 Ballad — six eighth-pulses to the bar, felt as two groups of three
 * (1·2·3, 4·5·6) with accents on 1 and 4. An arpeggiated mid-register walks the
 * pulse so it cannot be mistaken for the 4/4 ballad Feel.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const SIX_EIGHT: StylePreset = {
  id: 'sixEight',
  displayName: '6/8 Ballad',
  beatsPerBar: 6,
  stepsPerBar: 6,
  // Arpeggio on every pulse — the engine spreads one tone per hit.
  chord: {
    hits: [X, X, X, X, X, X],
    accent: [1.0, 0.55, 0.6, 0.9, 0.55, 0.6],
  },
  // Pillars on 1 and 4.
  bass: {
    hits: [X, o, o, X, o, o],
    accent: [1.0, 0.4, 0.4, 0.88, 0.4, 0.4],
  },
  kick: {
    hits: [X, o, o, X, o, o],
    accent: [0.9, 0.4, 0.4, 0.8, 0.4, 0.4],
  },
  snare: {
    hits: [o, o, o, X, o, o],
    accent: [0.4, 0.4, 0.4, 0.65, 0.4, 0.4],
  },
  hat: {
    hits: [X, X, X, X, X, X],
    accent: [0.55, 0.35, 0.4, 0.5, 0.35, 0.4],
    ghost: [o, X, X, o, X, X],
  },
  kickFeelMs: { min: -4, max: 4 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 3 },
    hat: { min: -5, max: 4 },
    snare: { min: 2, max: 10 },
    chord: { min: -3, max: 5 },
  },
  velocity: {
    center: { chord: 66, bass: 78, kick: 84, snare: 68, hat: 50 },
    accentDepth: 26,
    phraseDepth: 6,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 18,
    ghostMax: 36,
  },
  gate: {
    min: 0.78,
    max: 0.96,
    sustain: 'legato',
    byTrack: { bass: { min: 0.85, max: 0.99 } },
  },
  arpeggio: { direction: 'upDown' },
  roundRobin: 3,
};
