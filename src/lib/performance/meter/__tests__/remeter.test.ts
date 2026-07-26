import {
  AUTHORING_BEATS_PER_BAR,
  authoringBeats,
  remeterChords,
  remeterScale,
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
