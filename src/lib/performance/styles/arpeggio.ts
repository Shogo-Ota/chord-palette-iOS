/**
 * Arpeggio groove (pairs with the `arpeggio` accompaniment). The chord body is
 * actually spread — one note per 16th, cycling up then down through the voicing
 * ({@link StylePreset.arpeggio}) — instead of being struck as a block. The bass is a
 * soft down-beat drone so the harmony has a floor while the arpeggio flows above it.
 */

import type { StylePreset } from './types';

const B = false;
const H = true;

export const ARPEGGIO: StylePreset = {
  id: 'arpeggio',
  displayName: 'Arpeggio',
  beatsPerBar: 4,
  stepsPerBar: 16, // 16th grid — the arpeggio flows continuously
  // Continuous 16ths; the engine turns each hit into a single body note (see arpeggio).
  // Beat heads get a touch more weight so the pulse is still felt through the spread.
  chord: {
    hits: [H, H, H, H, H, H, H, H, H, H, H, H, H, H, H, H],
    accent: [0.8, 0.5, 0.55, 0.5, 0.7, 0.5, 0.55, 0.5, 0.75, 0.5, 0.55, 0.5, 0.68, 0.5, 0.55, 0.5],
  },
  // Bass drone on the beat heads only — soft, sustained floor under the arpeggio.
  bass: {
    hits: [H, B, B, B, H, B, B, B, H, B, B, B, H, B, B, B],
    accent: [0.9, 0.4, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4, 0.75, 0.4, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4],
  },
  kick: {
    hits: [H, B, B, B, B, B, B, B, H, B, B, B, B, B, B, B],
    accent: [0.9, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.85, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  snare: {
    hits: [B, B, B, B, H, B, B, B, B, B, B, B, H, B, B, B],
    accent: [0.4, 0.4, 0.4, 0.4, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.9, 0.4, 0.4, 0.4],
  },
  // Gentle 8th hats.
  hat: {
    hits: [H, B, H, B, H, B, H, B, H, B, H, B, H, B, H, B],
    accent: [0.7, 0.4, 0.55, 0.4, 0.65, 0.4, 0.55, 0.4, 0.68, 0.4, 0.55, 0.4, 0.62, 0.4, 0.55, 0.4],
  },
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 2 },
    hat: { min: -6, max: 4 },
    snare: { min: 4, max: 14 },
    chord: { min: -3, max: 3 },
  },
  velocity: {
    center: { chord: 70, bass: 78, kick: 96, snare: 90, hat: 58 },
    accentDepth: 26,
    phraseDepth: 6,
    humanizeMin: 4,
    humanizeMax: 6,
    ghostMin: 20,
    ghostMax: 40,
  },
  gate: { min: 0.72, max: 0.9, sustain: 'normal' },
  roundRobin: 4,
  // Natural ascending-then-descending bounce over the chord tones, endpoints not
  // repeated — a 7th spells 1 3 5 7 5 3 (repeat), tensions keep the same shape
  // (e.g. a 9th 1 3 5 7 9 7 5 3). Derived from the note count so triads / tension
  // chords never index out of range.
  arpeggio: { upDown: true },
};
