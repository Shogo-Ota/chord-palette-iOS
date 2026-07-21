import { buildExportPlan, buildSegments, pitchClassNamesFor } from '@/lib/exportPlan';
import type { ChordEvent } from '@/types';

function ev(partial: Partial<ChordEvent> & Pick<ChordEvent, 'rootOffset' | 'suffix'>): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'C',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    ...partial,
  } as ChordEvent;
}

const PROG: ChordEvent[] = [
  ev({ rootOffset: 0, suffix: '', displayName: 'C', degreeLabel: 'I', function: 'tonic', durationBeats: 4 }),
  ev({ rootOffset: 7, suffix: '', displayName: 'G', degreeLabel: 'V', function: 'dominant', durationBeats: 4 }),
];

describe('pitchClassNamesFor', () => {
  it('spells flats for flat keys and sharps for sharp keys', () => {
    expect(pitchClassNamesFor('C')).toHaveLength(12);
    expect(pitchClassNamesFor('F')[1]).toBe('D♭'); // flat key
    expect(pitchClassNamesFor('G')[1]).toBe('C#'); // sharp key
  });
});

describe('buildSegments (tile progression across the clip)', () => {
  it('is empty for an empty progression', () => {
    expect(buildSegments([], 'C', 120, 15)).toEqual([]);
  });

  it('lays chords end-to-end in seconds at the tempo', () => {
    // 120 BPM → 0.5s/beat → 4 beats = 2s per chord.
    const segs = buildSegments(PROG, 'C', 120, 4);
    expect(segs[0]).toMatchObject({ displayName: 'C', startSec: 0, durationSec: 2 });
    expect(segs[1]).toMatchObject({ displayName: 'G', startSec: 2, durationSec: 2 });
  });

  it('loops the progression to fill the whole duration', () => {
    const segs = buildSegments(PROG, 'C', 120, 10); // 2s each → 5 segments over 10s
    expect(segs).toHaveLength(5);
    expect(segs.map((s) => s.displayName)).toEqual(['C', 'G', 'C', 'G', 'C']);
  });

  it('clips the last segment to the duration boundary', () => {
    const segs = buildSegments(PROG, 'C', 120, 3); // C(0-2), G(2-3 clipped)
    expect(segs).toHaveLength(2);
    expect(segs[1]).toMatchObject({ startSec: 2, durationSec: 1 });
  });

  it('attaches voicing + function color to each segment', () => {
    const [c, g] = buildSegments(PROG, 'C', 120, 4);
    expect(c.midiNotes).toEqual([36, 48, 52, 55]); // C major triad + C2 bass (P0-2)
    expect(g.midiNotes.find((n) => n >= 48)).toBe(55); // G body root
    expect(c.colorHex).toMatch(/^#/);
    expect(g.colorHex).not.toBe(c.colorHex); // tonic vs dominant differ
  });
});

describe('buildSegments — multi-key indicator (keyTintHex / keyName)', () => {
  it('omits keyTintHex and keyName for a single-key progression', () => {
    const segs = buildSegments(PROG, 'C', 120, 4);
    expect(segs.every((s) => s.keyTintHex === undefined)).toBe(true);
    expect(segs.every((s) => s.keyName === undefined)).toBe(true);
  });

  it('tints each segment by its key context when the progression modulates', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 4, keyContext: 'C' }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 4, keyContext: 'G' }),
    ];
    const segs = buildSegments(prog, 'C', 120, 4);
    // Base key (first-seen 'C') = neutral; modulated 'G' = a distinct solid color.
    expect(segs[0].keyTintHex).toBeDefined();
    expect(segs[1].keyTintHex).toBeDefined();
    expect(segs[1].keyTintHex).not.toBe(segs[0].keyTintHex);
  });

  it('spells each segment key next to the degree when the progression modulates', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 4, keyContext: 'C' }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 4, keyContext: 'G' }),
    ];
    const segs = buildSegments(prog, 'C', 120, 4);
    expect(segs[0].keyName).toBe('C');
    expect(segs[1].keyName).toBe('G');
  });
});

describe('buildSegments — short (½ / ¼ bar) chords stay in sync', () => {
  // 120 BPM → 0.5 s/beat. Bar = 4 beats = 2 s, ½ bar = 2 beats = 1 s, ¼ bar = 1 beat = 0.5 s.
  it('lays half-bar chords at 1 s each', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 2 }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 2 }),
    ];
    const segs = buildSegments(prog, 'C', 120, 2);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ displayName: 'C', startSec: 0, durationSec: 1 });
    expect(segs[1]).toMatchObject({ displayName: 'G', startSec: 1, durationSec: 1 });
  });

  it('lays quarter-bar chords at 0.5 s each', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 1 }),
      ev({ rootOffset: 5, suffix: '', displayName: 'F', durationBeats: 1 }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 1 }),
      ev({ rootOffset: 9, suffix: 'm', displayName: 'Am', durationBeats: 1 }),
    ];
    const segs = buildSegments(prog, 'C', 120, 2);
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.startSec)).toEqual([0, 0.5, 1, 1.5]);
    expect(segs.every((s) => Math.abs(s.durationSec - 0.5) < 1e-9)).toBe(true);
  });

  it('keeps mixed durations contiguous and non-overlapping', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 4 }),
      ev({ rootOffset: 9, suffix: 'm', displayName: 'Am', durationBeats: 2 }),
      ev({ rootOffset: 5, suffix: '', displayName: 'F', durationBeats: 1 }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 1 }),
    ];
    // totalBeats = 8 → 4 s at 120 BPM.
    const segs = buildSegments(prog, 'C', 120, 4);
    expect(segs).toHaveLength(4);
    // Each segment starts exactly where the previous one ended (no gaps/overlaps).
    for (let i = 1; i < segs.length; i += 1) {
      expect(segs[i].startSec).toBeCloseTo(segs[i - 1].startSec + segs[i - 1].durationSec, 9);
    }
    expect(segs.map((s) => s.startSec)).toEqual([0, 2, 3, 3.5]);
  });
});

describe('buildExportPlan — one dot per chord regardless of chord length', () => {
  it('sets chordsPerCycle to the chord count for short/mixed progressions', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: '', displayName: 'C', durationBeats: 1 }),
      ev({ rootOffset: 5, suffix: '', displayName: 'F', durationBeats: 2 }),
      ev({ rootOffset: 7, suffix: '', displayName: 'G', durationBeats: 1 }),
    ];
    const totalBeats = prog.reduce((s, e) => s + e.durationBeats, 0);
    const plan = buildExportPlan({
      progression: prog,
      key: 'C',
      bpm: 120,
      title: 'Short',
      durationSec: (totalBeats * 60) / 120,
      audioUri: 'file:///a.m4a',
      watermark: false,
    });
    // One dot per chord even though chords are ¼ / ½ bar.
    expect(plan.chordsPerCycle).toBe(prog.length);
    // The dot-cycle segments match the chord count exactly (one pass, no clipping loss).
    expect(plan.segments).toHaveLength(prog.length);
  });
});

describe('buildExportPlan', () => {
  it('fills plan metadata and defaults', () => {
    const plan = buildExportPlan({
      progression: PROG,
      key: 'C',
      bpm: 120,
      title: 'Test',
      durationSec: 15,
      audioUri: 'file:///a.m4a',
      watermark: false,
    });
    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.fps).toBe(30);
    expect(plan.keyLabel).toBe('C');
    expect(plan.bars).toBe(2); // 8 beats / 4
    expect(plan.pitchClassNames).toHaveLength(12);
    expect(plan.audioUri).toBe('file:///a.m4a');
    expect(plan.segments.length).toBeGreaterThan(0);
  });
});
