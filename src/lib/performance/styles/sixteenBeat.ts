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
  // Tidied 16th comp: each beat head plus its "a" (4th 16th) push — tight and even,
  // deliberately not over-packed. Beat heads carry the weight; the "a"s add drive.
  chord: {
    hits: [H, B, B, H, H, B, B, H, H, B, B, H, H, B, B, H],
    accent: [1.0, 0.4, 0.4, 0.55, 0.7, 0.4, 0.4, 0.55, 0.85, 0.4, 0.4, 0.55, 0.7, 0.4, 0.4, 0.55],
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
  // City Engine v1 (city_engine_spec §7/§9): the 16th lattice reads as 洗練 when
  // the grains line up — chord timing and velocity spread tightened so the comp
  // sounds even and polished rather than loose.
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -6, max: 4 },
    snare: { min: 4, max: 14 },
    chord: { min: -3, max: 3 },
  },
  velocity: {
    center: { chord: 76, bass: 86, kick: 102, snare: 96, hat: 62 },
    accentDepth: 36,
    phraseDepth: 8,
    humanizeMin: 3,
    humanizeMax: 5,
    ghostMin: 20,
    ghostMax: 45,
  },
  gate: { min: 0.72, max: 0.92, sustain: 'normal' },
  roundRobin: 4,
  // The "a" pushes lean into the following chord a 16th–8th early.
  anticipation: { maxLeadBeats: 0.5 },
};
