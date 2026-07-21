import { ACCOMPANIMENT_IDS } from '@/data/labels';
import type { TrackId } from '@/lib/performance/NoteEvent';
import {
  generatePerformance,
  type PerfChord,
  type PerformanceInput,
} from '@/lib/performance/PerformanceEngine';

/* A plain 4-chord × 4-beat progression (16 beats = 4 bars). */
function chord(body: number[], bass: number[], startBeat: number): PerfChord {
  return { bodyMidi: body, bassMidi: bass, startBeat, durationBeats: 4 };
}

const PROG: PerfChord[] = [
  chord([60, 64, 67], [36, 48], 0), // C
  chord([62, 65, 69], [38, 50], 4), // Dm
  chord([64, 67, 71], [40, 52], 8), // Em
  chord([59, 62, 65], [35, 47], 12), // Bdim-ish
];

const INPUT: PerformanceInput = { chords: PROG, bpm: 108, seed: 20260719 };

function hasTrack(id: string, track: TrackId): boolean {
  return generatePerformance(INPUT, { styleId: id, grooveId: 'pop8' }).some((e) => e.trackId === track);
}

describe('PerformanceEngine — Block plays once per bar (design: 1小節1回)', () => {
  it('emits exactly one chord attack per bar', () => {
    const chords = generatePerformance(INPUT, { styleId: 'block' }).filter((e) => e.trackId === 'chord');
    const attacksPerBar = new Map<number, Set<string>>();
    for (const e of chords) {
      const bar = Math.floor(e.timeBeat / 4 + 1e-6);
      const set = attacksPerBar.get(bar) ?? new Set<string>();
      set.add(e.timeBeat.toFixed(4));
      attacksPerBar.set(bar, set);
    }
    expect(attacksPerBar.size).toBe(4);
    for (const set of attacksPerBar.values()) expect(set.size).toBe(1);
  });
});

describe('PerformanceEngine — the five accompaniment ids', () => {
  it('every id produces sorted, valid, positive-duration events', () => {
    for (const id of ACCOMPANIMENT_IDS) {
      const events = generatePerformance(INPUT, { styleId: id, grooveId: 'pop8' });
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => e.velocity >= 1 && e.velocity <= 127)).toBe(true);
      expect(events.every((e) => e.durationBeat > 0)).toBe(true);
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timeBeat).toBeGreaterThanOrEqual(events[i - 1].timeBeat - 1e-9);
      }
    }
  });

  it('each id is deterministic (same seed ⇒ identical events)', () => {
    for (const id of ACCOMPANIMENT_IDS) {
      const a = generatePerformance(INPUT, { styleId: id, grooveId: 'pop8' });
      const b = generatePerformance(INPUT, { styleId: id, grooveId: 'pop8' });
      expect(a).toEqual(b);
    }
  });
});

describe('PerformanceEngine — Feel wiring (role-separation top voice)', () => {
  it('driving & relaxed emit a top voice; natural/block/arpeggio do not', () => {
    expect(hasTrack('natural', 'top')).toBe(false);
    expect(hasTrack('driving', 'top')).toBe(true);
    // Relaxed now adds a single 3rd on beat 3 as its top voice.
    expect(hasTrack('relaxed', 'top')).toBe(true);
    expect(hasTrack('block', 'top')).toBe(false);
    expect(hasTrack('arpeggio', 'top')).toBe(false);
  });

  it('grooveId shifts driving onto a busier 16-feel base at the same tempo', () => {
    // On a 16-groove the driving feel resolves to the 16-step skeleton, so the
    // chord track fires more attacks than on the 8-groove at the same tempo/seed.
    const attacks = (grooveId: string) =>
      generatePerformance(INPUT, { styleId: 'driving', grooveId, drums: false }).filter(
        (e) => e.trackId === 'chord',
      ).length;
    expect(attacks('pop16')).toBeGreaterThan(attacks('pop8'));
  });

  it('feels honour drums:false (no kick/snare/hat emitted)', () => {
    const events = generatePerformance(INPUT, { styleId: 'natural', grooveId: 'pop8', drums: false });
    expect(events.some((e) => e.trackId === 'kick' || e.trackId === 'snare' || e.trackId === 'hat')).toBe(
      false,
    );
    expect(events.some((e) => e.trackId === 'chord')).toBe(true);
  });
});
