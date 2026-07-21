/**
 * Strum ("roll") — pure helper unit tests + end-to-end proof that a block chord's
 * body notes are spread (rolled) by the engine while single-note / arpeggio strikes
 * stay simultaneous, and that the result is fully seed-deterministic.
 */

import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { createRng } from '@/lib/performance/rng';
import { strumOffsetBeats, strumVelocityScale } from '@/lib/performance/strum';
import type { StrumSpec } from '@/lib/performance/styles/types';
import type { ChordEvent, MajorKey } from '@/types';

const UP: StrumSpec = { spreadMs: 15, direction: 'up' };

function ev(rootOffset: number, suffix: string, durationBeats = 4): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
  } as ChordEvent;
}

describe('strumOffsetBeats — pure helper', () => {
  it('returns 0 for a single note or zero spread', () => {
    expect(strumOffsetBeats(0, 1, UP, 120, createRng(1))).toBe(0);
    expect(strumOffsetBeats(0, 4, { spreadMs: 0, direction: 'up' }, 120, createRng(1))).toBe(0);
  });

  it('up-strum: offset increases monotonically with pitch rank, first note on the beat', () => {
    const size = 4;
    const offs = Array.from({ length: size }, (_, r) => strumOffsetBeats(r, size, UP, 120, createRng(1)));
    expect(offs[0]).toBe(0); // low note lands on the beat
    for (let i = 1; i < size; i++) expect(offs[i]).toBeGreaterThan(offs[i - 1]);
  });

  it('down-strum reverses the order (high note first)', () => {
    const size = 3;
    const down: StrumSpec = { spreadMs: 15, direction: 'down' };
    const offs = Array.from({ length: size }, (_, r) => strumOffsetBeats(r, size, down, 120, createRng(1)));
    expect(offs[size - 1]).toBe(0); // highest note lands on the beat
    expect(offs[0]).toBeGreaterThan(offs[size - 1]);
  });

  it('never exceeds the spread window (beats) and respects the maxBeat clamp', () => {
    const size = 4;
    const spreadBeat = (UP.spreadMs * 120) / 60000; // ms → beats @120bpm
    for (let r = 0; r < size; r++) {
      const o = strumOffsetBeats(r, size, UP, 120, createRng(7));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(spreadBeat + 1e-9);
    }
    // Tight clamp: never pushes past the note's own (short) window.
    expect(strumOffsetBeats(3, 4, UP, 120, createRng(7), 0, 0.001)).toBeLessThanOrEqual(0.001);
  });

  it('is deterministic given the same seeded stream', () => {
    const a = strumOffsetBeats(2, 4, { ...UP, humanizeMs: 4 }, 100, createRng(42));
    const b = strumOffsetBeats(2, 4, { ...UP, humanizeMs: 4 }, 100, createRng(42));
    expect(a).toBe(b);
  });
});

describe('strumVelocityScale — pure helper', () => {
  it('is 1 with no falloff or a single note', () => {
    expect(strumVelocityScale(2, 4, UP)).toBe(1);
    expect(strumVelocityScale(0, 1, { ...UP, velocityFalloff: 0.3 })).toBe(1);
  });

  it('softens later notes of the roll', () => {
    const spec: StrumSpec = { ...UP, velocityFalloff: 0.3 };
    expect(strumVelocityScale(0, 4, spec)).toBe(1);
    expect(strumVelocityScale(3, 4, spec)).toBeCloseTo(0.7, 6);
  });
});

describe('strum — end to end via the Natural feel (has strum) and Block (none)', () => {
  const key: MajorKey = 'C';
  const prog = [ev(0, 'maj7'), ev(5, 'maj7'), ev(7, '7'), ev(9, 'm7')];

  function chordTimesByStrike(styleId: string) {
    const chords = progressionToPerfChords(prog, key);
    const notes = generatePerformance({ chords, bpm: 100, seed: 99 }, { styleId, grooveId: 'pop8', drums: false });
    const chord = notes.filter((n) => n.trackId === 'chord');
    // Group chord-note onsets by their (quantized) grid position.
    const byBeat = new Map<number, Set<number>>();
    for (const n of chord) {
      const key = Math.round(n.timeBeat * 4) / 4; // nearest 16th, tolerant of jitter
      const set = byBeat.get(key) ?? new Set<number>();
      set.add(Number(n.timeBeat.toFixed(5)));
      byBeat.set(key, set);
    }
    return byBeat;
  }

  it('rolls a block chord: notes of one strike get DISTINCT onsets under Natural', () => {
    const byBeat = chordTimesByStrike('natural');
    // At least one strike must have >1 distinct onset (the roll spread the notes).
    const rolled = [...byBeat.values()].some((set) => set.size > 1);
    expect(rolled).toBe(true);
  });

  it('Block style has no strum: every note of a strike shares one onset', () => {
    const byBeat = chordTimesByStrike('block');
    const anyRolled = [...byBeat.values()].some((set) => set.size > 1);
    expect(anyRolled).toBe(false);
  });

  it('is fully deterministic: same seed reproduces byte-identical output', () => {
    const chords = progressionToPerfChords(prog, key);
    const a = generatePerformance({ chords, bpm: 100, seed: 5 }, { styleId: 'natural', grooveId: 'pop8', drums: false });
    const b = generatePerformance({ chords, bpm: 100, seed: 5 }, { styleId: 'natural', grooveId: 'pop8', drums: false });
    expect(a).toEqual(b);
  });
});
