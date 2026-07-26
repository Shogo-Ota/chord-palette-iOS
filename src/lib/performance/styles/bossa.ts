/**
 * Bossa Nova — 4/4, light and settled. Bass and chord take turns so neither crowds
 * the other; the chord pattern is syncopated (off the beat heads) so the bar leans
 * forward without getting loud. Gate sits soft and short-of-legato so the left hand
 * can breathe between hits.
 *
 * The bass track still voices the chord root — a true root/5th alternation would
 * need the engine to pick a different chord tone per step, which is a later change.
 * The *rhythm* of that alternation is already here: bass hits leave room for the
 * syncopated comps between them.
 */

import type { StylePreset } from './types';

const X = true;
const o = false;

export const BOSSA: StylePreset = {
  id: 'bossa',
  displayName: 'Bossa Nova',
  beatsPerBar: 4,
  stepsPerBar: 8,
  // Syncopated comps: &-of-1, beat 2, &-of-3, beat 4 — never stacked on the bass.
  chord: {
    hits: [o, X, X, o, o, X, X, o],
    accent: [0.4, 0.62, 0.78, 0.4, 0.4, 0.6, 0.75, 0.4],
  },
  // Bass on 1, &-of-2, 3, &-of-4 — the classic bossa left-hand skeleton.
  bass: {
    hits: [X, o, o, X, X, o, o, X],
    accent: [0.95, 0.4, 0.4, 0.7, 0.88, 0.4, 0.4, 0.65],
  },
  kick: {
    hits: [X, o, o, X, X, o, o, X],
    accent: [0.8, 0.4, 0.4, 0.55, 0.72, 0.4, 0.4, 0.5],
  },
  snare: {
    hits: [o, o, o, o, o, o, o, o],
    accent: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  },
  hat: {
    hits: [X, o, X, o, X, o, X, o],
    accent: [0.5, 0.35, 0.42, 0.35, 0.48, 0.35, 0.42, 0.35],
  },
  kickFeelMs: { min: -3, max: 3 },
  microtiming: {
    kick: { min: -2, max: 2 },
    bass: { min: -2, max: 3 },
    hat: { min: -5, max: 4 },
    snare: { min: 0, max: 4 },
    chord: { min: -3, max: 5 },
  },
  velocity: {
    center: { chord: 64, bass: 76, kick: 78, snare: 60, hat: 48 },
    accentDepth: 24,
    phraseDepth: 5,
    humanizeMin: 4,
    humanizeMax: 6,
    ghostMin: 18,
    ghostMax: 36,
  },
  gate: { min: 0.55, max: 0.78, sustain: 'normal' },
  roundRobin: 3,
  strum: { spreadMs: 18, direction: 'up', humanizeMs: 4, velocityFalloff: 0.15 },
};
