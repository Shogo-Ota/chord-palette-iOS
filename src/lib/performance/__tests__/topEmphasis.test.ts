/**
 * Top-note emphasis (implementation_v1.01 Phase 4): within a multi-pitch chord
 * strike the highest voice is lifted (+3 by default) and the inner voices sit
 * slightly back (−1), so a block chord reads as a hand voicing a melody note
 * rather than a machine stamping equal keys. Single-pitch strikes, bass and
 * drums are untouched.
 */

import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import { computeVelocity } from '@/lib/performance/velocity';
import { BLOCK } from '@/lib/performance/styles/block';
import { createRng } from '@/lib/performance/rng';

describe('computeVelocity — chord-role term', () => {
  function velocity(chordRole?: 'top' | 'inner'): number {
    // Same rng seed for every call, so the role term is the ONLY difference.
    return computeVelocity({
      style: BLOCK,
      track: 'chord',
      accent: 0.6,
      bar: 0,
      ghost: false,
      chordRole,
      rng: createRng(42),
    });
  }

  it('lifts the top by the default (+3) and sits inner voices back (−1)', () => {
    expect(velocity('top')).toBe(velocity(undefined) + 3);
    expect(velocity('inner')).toBe(velocity(undefined) - 1);
  });
});

describe('rendered block chords', () => {
  it('sound their highest voice above the inner voices on average', () => {
    const prog = EVAL_PROGRESSIONS[0]; // A: C – G – Am – F
    const notes = generatePerformance(
      { chords: progressionToPerfChords(prog.chords, prog.key), bpm: prog.bpm, seed: 5 },
      { styleId: 'block', drums: false },
    ).filter((n) => n.trackId === 'chord');

    // Group into strikes by (rounded) onset.
    const strikes = new Map<number, NoteEvent[]>();
    for (const n of notes) {
      const key = Math.round(n.timeBeat * 8);
      strikes.set(key, [...(strikes.get(key) ?? []), n]);
    }

    const tops: number[] = [];
    const inners: number[] = [];
    for (const strike of strikes.values()) {
      if (strike.length < 2) continue;
      const top = strike.reduce((m, n) => (n.pitch > m.pitch ? n : m), strike[0]);
      for (const n of strike) (n === top ? tops : inners).push(n.velocity);
    }
    expect(tops.length).toBeGreaterThan(0);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Expected gap is topEmphasis (+3) − inner (−1) = 4; humanize noise averages out.
    expect(mean(tops)).toBeGreaterThan(mean(inners) + 1);
  });

  it('leaves the bass untouched by role shaping (same across chord sizes)', () => {
    const prog = EVAL_PROGRESSIONS[0];
    const bass = generatePerformance(
      { chords: progressionToPerfChords(prog.chords, prog.key), bpm: prog.bpm, seed: 5 },
      { styleId: 'block', drums: false },
    ).filter((n) => n.trackId === 'bass');
    for (const n of bass) {
      expect(n.velocity).toBeGreaterThanOrEqual(1);
      expect(n.velocity).toBeLessThanOrEqual(127);
    }
  });
});
