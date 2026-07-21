/**
 * Next-chord suggestion — functional-harmony correctness, standard-progression
 * continuation, free/pro gating, and determinism. Pure domain (no React).
 */

import { suggestNext, suggestionToChordEvent } from '@/lib/theory/progression/suggestNext';
import type { ChordFunction, MajorKey } from '@/types';

const KEY: MajorKey = 'C';

/** Minimal chord input: degree offset + its function. */
function c(rootOffset: number, fn: ChordFunction) {
  return { rootOffset, function: fn };
}

const I = c(0, 'tonic');
const V = c(7, 'dominant');
const vi = c(9, 'tonic');

describe('suggestNext — start (empty progression)', () => {
  const out = suggestNext([], KEY, { allowPro: false });

  it('offers I first and only free chords', () => {
    expect(out[0].rootOffset).toBe(0);
    expect(out[0].reason).toBe('start');
    expect(out.every((s) => !s.isPro)).toBe(true);
  });

  it('caps to maxResults (default 4)', () => {
    expect(out.length).toBeLessThanOrEqual(4);
  });
});

describe('suggestNext — functional pull', () => {
  it('after I, offers subdominant and dominant moves', () => {
    const out = suggestNext([I], KEY, { allowPro: false, maxResults: 7 });
    const offsets = new Set(out.map((s) => s.rootOffset));
    expect(offsets.has(7)).toBe(true); // V (dominant)
    expect(offsets.has(5) || offsets.has(2)).toBe(true); // IV or ii (subdominant)
  });

  it('near a phrase end, a dominant resolves to I with a cadence (top pick)', () => {
    // 3 chords placed → the 4th is the phrase-ending resolution.
    const out = suggestNext([I, vi, V], KEY, { allowPro: false });
    expect(out[0].rootOffset).toBe(0);
    expect(out[0].reason).toBe('cadence');
  });
});

describe('suggestNext — standard-progression continuation', () => {
  it('I–V–vi → IV as the confident next chord (axis progression)', () => {
    const out = suggestNext([I, V, vi], KEY, { allowPro: false });
    expect(out[0].rootOffset).toBe(5); // IV
    expect(out[0].reason).toBe('template');
    expect(out[0].score).toBeGreaterThan(0.9);
  });
});

describe('suggestNext — free vs pro gating', () => {
  it('free never returns a Pro (borrowed / secondary) chord', () => {
    const out = suggestNext([I], KEY, { allowPro: false, maxResults: 20 });
    expect(out.some((s) => s.isPro)).toBe(false);
  });

  it('pro mixes in at least one Pro colour', () => {
    const out = suggestNext([I], KEY, { allowPro: true, maxResults: 20 });
    expect(out.some((s) => s.isPro)).toBe(true);
    expect(out.some((s) => s.reason === 'secondaryDominant' || s.reason === 'modal')).toBe(true);
  });
});

describe('suggestNext — determinism & mapping', () => {
  it('same input yields identical ranking', () => {
    const a = suggestNext([I, V], KEY, { allowPro: true });
    const b = suggestNext([I, V], KEY, { allowPro: true });
    expect(a).toEqual(b);
  });

  it('suggestionToChordEvent produces an id-less ChordEvent (default full bar)', () => {
    const [top] = suggestNext([I, V, vi], KEY, { allowPro: false });
    const ev = suggestionToChordEvent(top);
    expect(ev.rootOffset).toBe(top.rootOffset);
    expect(ev.suffix).toBe(top.suffix);
    expect(ev.isPro).toBe(top.isPro);
    expect(ev.durationBeats).toBe(4);
    expect(ev.chordId.startsWith('sugg-')).toBe(true);
    expect(ev).not.toHaveProperty('id');
  });
});
