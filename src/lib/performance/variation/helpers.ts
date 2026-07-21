/**
 * Shared, pure helpers for the Variation rules (design §3-2). Kept separate so each
 * rule file stays a single-responsibility Strategy and the phrase / beat-position
 * bookkeeping lives in one tested place.
 */

import type { Strike, StrikesByTrack } from '../strike';
import { stepBeat, type StylePreset } from '../styles/types';

const EPSILON = 1e-9;

/** The bar head (beat 1) — always protected from rests/ties (design §3-2). */
export function isBarHead(strike: Strike): boolean {
  return strike.step === 0;
}

/** A strong beat = a strike landing exactly on an integer beat of the bar. */
export function isBeatHead(style: StylePreset, step: number): boolean {
  const beat = stepBeat(style, step);
  return Math.abs(beat - Math.round(beat)) < EPSILON;
}

/** Which 4-bar phrase a bar belongs to. */
export function phraseOf(bar: number, phraseLength: number): number {
  return Math.floor(bar / phraseLength);
}

/** Position of a bar within its phrase (0 = 1st bar … phraseLength-1 = last). */
export function phraseIndexOf(bar: number, phraseLength: number): number {
  return bar % phraseLength;
}

/** Deep copy of the strikes map so rules can mutate freely without side effects. */
export function cloneStrikes(strikes: StrikesByTrack): StrikesByTrack {
  const out: StrikesByTrack = {};
  for (const [track, list] of Object.entries(strikes)) {
    if (list) out[track as keyof StrikesByTrack] = list.map((s) => ({ ...s, pitches: [...s.pitches] }));
  }
  return out;
}

/** Sort a track's strikes back into grid order (needed after add/remove rules). */
export function sortStrikes(list: Strike[]): Strike[] {
  return [...list].sort((a, b) => a.gridBeat - b.gridBeat || a.step - b.step);
}

/** Is there already a strike on this exact bar+step? (guards against duplicates). */
export function hasStrikeAt(list: Strike[], bar: number, step: number): boolean {
  return list.some((s) => s.bar === bar && s.step === step);
}
