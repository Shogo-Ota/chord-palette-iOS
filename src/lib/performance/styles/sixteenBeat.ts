/**
 * 16-Beat groove (pairs with the existing `sixteenthBeat` accompaniment / `pop16`
 * drum feel). Busier 16th grid with syncopated chord stabs and kick, backbeat snare
 * on 2 & 4, and continuous ghosted 16th hats.
 */

import type { StylePreset } from './types';

const B = false;
const H = true;

export const SIXTEEN_BEAT: StylePreset = {
  id: 'sixteenBeat',
  displayName: '16 Beat',
  beatsPerBar: 4,
  stepsPerBar: 16, // 16th-note grid
  // Syncopated comp: strong on beats, plus the "e/a" pushes into 2 and 4.
  chord: {
    hits: [H, B, B, H, H, B, B, H, H, B, B, H, H, B, B, B],
    accent: [1.0, 0.4, 0.4, 0.55, 0.7, 0.4, 0.4, 0.55, 0.85, 0.4, 0.4, 0.55, 0.7, 0.4, 0.4, 0.5],
  },
  bass: {
    hits: [H, B, B, B, B, B, H, B, H, B, B, B, B, B, H, B],
    accent: [1.0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.4, 0.85, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.4],
  },
  kick: {
    hits: [H, B, B, B, B, B, H, B, H, B, B, B, B, B, H, B],
    accent: [1.0, 0.4, 0.4, 0.4, 0.4, 0.4, 0.65, 0.4, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4, 0.65, 0.4],
  },
  snare: {
    hits: [B, B, B, B, H, B, B, B, B, B, B, B, H, B, B, B],
    accent: [0.4, 0.4, 0.4, 0.4, 0.95, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.95, 0.4, 0.4, 0.4],
  },
  // Continuous 16th hats; every off-16th is ghosted so the groove breathes.
  hat: {
    hits: [H, H, H, H, H, H, H, H, H, H, H, H, H, H, H, H],
    accent: [0.8, 0.4, 0.6, 0.4, 0.72, 0.4, 0.6, 0.4, 0.78, 0.4, 0.6, 0.4, 0.72, 0.4, 0.6, 0.4],
    ghost: [B, H, B, H, B, H, B, H, B, H, B, H, B, H, B, H],
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
    center: { chord: 76, bass: 86, kick: 102, snare: 96, hat: 62 },
    accentDepth: 36,
    phraseDepth: 8,
    humanizeMin: 4,
    humanizeMax: 7,
    ghostMin: 20,
    ghostMax: 45,
  },
  gate: { min: 0.72, max: 0.92, sustain: 'normal' },
  roundRobin: 4,
};
