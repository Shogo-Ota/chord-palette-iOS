import {
  AUTHORING_BEATS_PER_BAR,
  authoringBeats,
  remeterChords,
  remeterScale,
  rescaleBeats,
} from '@/lib/performance/meter';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';

const bar = (start: number, duration: number): PerfChord => ({
  bodyMidi: [60, 64, 67],
  bassMidi: [36],
  startBeat: start,
  durationBeats: duration,
});

describe('remeter', () => {
  it('leaves 4/4 alone', () => {
    const chords = [bar(0, 4), bar(4, 2)];
    expect(remeterChords(chords, 4)).toBe(chords);
    expect(remeterScale(4)).toBe(1);
  });

  it('maps one stored bar onto one waltz bar', () => {
    const [c] = remeterChords([bar(0, 4)], 3);
    expect(c.startBeat).toBe(0);
    expect(c.durationBeats).toBe(3);
    expect(AUTHORING_BEATS_PER_BAR).toBe(4);
  });

  it('maps one stored bar onto one 6/8 bar', () => {
    const chords = remeterChords([bar(0, 4), bar(4, 4)], 6);
    expect(chords[0].durationBeats).toBe(6);
    expect(chords[1].startBeat).toBe(6);
    expect(chords[1].durationBeats).toBe(6);
  });

  it('round-trips the playhead through authoring space', () => {
    expect(authoringBeats(remeterScale(3) * 4, 3)).toBeCloseTo(4);
    expect(authoringBeats(3, 3)).toBeCloseTo(4);
  });
});

describe('rescaleBeats — swapping the rhythm mid-playback', () => {
  it('is a no-op between rhythms that share a meter', () => {
    expect(rescaleBeats(7.5, 4, 4)).toBeCloseTo(7.5);
  });

  it('keeps the playhead on the same bar when the bar changes length', () => {
    // Four bars is 16 beats in 4/4 and 12 in a waltz. Beat 12 is the top of bar 4
    // either way; carried across raw it would have folded back to the first chord.
    expect(rescaleBeats(12, 4, 3)).toBeCloseTo(9);
    expect(rescaleBeats(12, 4, 6)).toBeCloseTo(18);
  });

  it('reverses itself, so switching away and back lands where it started', () => {
    for (const [from, to] of [
      [4, 3],
      [3, 6],
      [6, 4],
    ] as const) {
      expect(rescaleBeats(rescaleBeats(5, from, to), to, from)).toBeCloseTo(5);
    }
  });

  it('never sends the playhead past the end of the shorter loop', () => {
    // Four bars: 16 beats in 4/4, 12 in a waltz. The last instant of the 4/4 loop
    // must land at the last instant of the waltz loop, not beyond it.
    expect(rescaleBeats(16, 4, 3)).toBeCloseTo(12);
    expect(rescaleBeats(15.9, 4, 3)).toBeLessThan(12);
  });
});
