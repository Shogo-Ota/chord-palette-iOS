import {
  BEATS_PER_BAR,
  MAX_BARS,
  appendWithinCap,
  canAdd,
  canSetDuration,
  chordIndexAtBeat,
  durationLabel,
  totalBars,
} from '@/lib/progression';
import type { ChordDuration, ChordEvent } from '@/types';

function ev(durationBeats: ChordDuration): ChordEvent {
  return {
    id: `t-${Math.random()}`,
    chordId: 'C',
    displayName: 'C',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset: 0,
    suffix: '',
  };
}

function bars(n: number): ChordEvent[] {
  return Array.from({ length: n }, () => ev(4));
}

describe('totalBars', () => {
  it('sums beats into bars', () => {
    expect(totalBars([ev(4), ev(2), ev(2)])).toBe(2);
    expect(totalBars([])).toBe(0);
  });
});

describe('canAdd (16-bar cap, requirements §6)', () => {
  it('allows adding when under the cap', () => {
    expect(canAdd(bars(MAX_BARS - 1), 4)).toBe(true);
  });

  it('allows filling exactly to the cap', () => {
    expect(canAdd(bars(MAX_BARS - 1), 4)).toBe(true);
    expect(totalBars(bars(MAX_BARS))).toBe(MAX_BARS);
  });

  it('rejects adding a whole bar when already at the cap', () => {
    expect(canAdd(bars(MAX_BARS), 4)).toBe(false);
  });

  it('still allows a fractional add that fits within the cap', () => {
    // 15.5 bars used, adding 1/2 bar (2 beats) fits to exactly 16.
    const used = [...bars(15), ev(2)];
    expect(canAdd(used, 2)).toBe(true);
    expect(canAdd(used, 4)).toBe(false);
  });
});

describe('canSetDuration (16-bar cap on resize)', () => {
  it('always allows shrinking a chord (even when full)', () => {
    const prog = bars(MAX_BARS); // 64 beats, exactly full
    expect(canSetDuration(prog, 0, 2)).toBe(true);
    expect(canSetDuration(prog, 0, 1)).toBe(true);
  });

  it('rejects growing a chord past the cap', () => {
    // 60 + 2 + 1 = 63 beats used; the 1/4 chord sits at index 16.
    const prog = [...bars(15), ev(2), ev(1)];
    expect(canSetDuration(prog, 16, 4)).toBe(false); // +3 beats → 66 > 64
  });

  it('allows a grow that lands exactly on the cap', () => {
    // 63 beats used; growing the 1/4 chord (1→2 beats) → exactly 64 beats.
    const prog = [...bars(15), ev(2), ev(1)];
    expect(canSetDuration(prog, 16, 2)).toBe(true);
  });

  it('returns false for an out-of-range index', () => {
    expect(canSetDuration(bars(2), -1, 4)).toBe(false);
    expect(canSetDuration(bars(2), 5, 4)).toBe(false);
  });
});

describe('appendWithinCap (recall a stored progression onto the tail)', () => {
  it('appends the whole incoming progression when it fits', () => {
    const res = appendWithinCap(bars(2), bars(3));
    expect(res.appended).toBe(3);
    expect(res.dropped).toBe(0);
    expect(res.events).toHaveLength(5);
  });

  it('clips to the cap and reports the dropped count', () => {
    // 14 bars used; appending 4 whole bars → only 2 fit, 2 dropped.
    const res = appendWithinCap(bars(14), bars(4));
    expect(res.appended).toBe(2);
    expect(res.dropped).toBe(2);
    expect(totalBars(res.events)).toBe(MAX_BARS);
  });

  it('keeps the appended block contiguous (stops at the first chord that does not fit)', () => {
    // 15.5 bars used. Incoming: whole bar (does not fit) then a 1/2 bar (would fit).
    // We stop at the first miss so the recalled block stays contiguous.
    const used = [...bars(15), ev(2)];
    const res = appendWithinCap(used, [ev(4), ev(2)]);
    expect(res.appended).toBe(0);
    expect(res.dropped).toBe(2);
  });

  it('does not mutate the input progression', () => {
    const current = bars(2);
    appendWithinCap(current, bars(1));
    expect(current).toHaveLength(2);
  });
});

describe('durationLabel', () => {
  it('maps beats to labels', () => {
    expect(durationLabel(4)).toBe('1小節');
    expect(durationLabel(2)).toBe('1/2');
    expect(durationLabel(1)).toBe('1/4');
  });
});

describe('constants', () => {
  it('uses 4/4 and a 16-bar cap', () => {
    expect(BEATS_PER_BAR).toBe(4);
    expect(MAX_BARS).toBe(16);
  });
});

describe('chordIndexAtBeat (playhead card index)', () => {
  const prog = [ev(4), ev(2), ev(2)]; // beats 0–4, 4–6, 6–8

  it('returns -1 for empty / negative beat', () => {
    expect(chordIndexAtBeat([], 0)).toBe(-1);
    expect(chordIndexAtBeat(prog, -0.1)).toBe(-1);
  });

  it('maps beats onto progression cards (not note-event indices)', () => {
    expect(chordIndexAtBeat(prog, 0)).toBe(0);
    expect(chordIndexAtBeat(prog, 3.9)).toBe(0);
    expect(chordIndexAtBeat(prog, 4)).toBe(1);
    expect(chordIndexAtBeat(prog, 5.5)).toBe(1);
    expect(chordIndexAtBeat(prog, 6)).toBe(2);
    expect(chordIndexAtBeat(prog, 7.99)).toBe(2);
  });

  it('clamps past the end onto the last card', () => {
    expect(chordIndexAtBeat(prog, 8)).toBe(2);
    expect(chordIndexAtBeat(prog, 99)).toBe(2);
  });
});
