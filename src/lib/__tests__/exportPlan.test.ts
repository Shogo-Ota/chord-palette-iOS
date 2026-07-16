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
    expect(c.midiNotes).toEqual([24, 36, 48, 52, 55]); // C major triad + C1/C2 bass
    expect(g.midiNotes.find((n) => n >= 48)).toBe(55); // G body root
    expect(c.colorHex).toMatch(/^#/);
    expect(g.colorHex).not.toBe(c.colorHex); // tonic vs dominant differ
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
