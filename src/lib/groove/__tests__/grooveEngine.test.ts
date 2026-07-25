import {
  compilePianoBeatStrikes,
  compilePianoStrikes,
  getDrumPattern,
  gridOnsetBeats,
  grooveProfileFor,
  humanizeGain,
  PRODUCT_ACCOMPANIMENT_IDS,
  PRODUCT_GROOVE_IDS,
  timingSway,
} from '@/lib/groove';
import type { ChordTimelineEvent } from '@/lib/groove/types';

const sampleEvents: ChordTimelineEvent[] = [
  { midiNotes: [24, 36, 48, 52, 55], startBeat: 0, lengthBeats: 4, velocity: 100 },
  { midiNotes: [31, 43, 55, 59, 62], startBeat: 4, lengthBeats: 4, velocity: 100 },
];

describe('humanize determinism', () => {
  it('returns identical gain for the same seed', () => {
    expect(humanizeGain(0.8, 1.25, 0.11)).toBe(humanizeGain(0.8, 1.25, 0.11));
  });

  it('returns identical timing sway for the same seed', () => {
    expect(timingSway(2.5, 0.018)).toBe(timingSway(2.5, 0.018));
  });

  it('clamps when amount is zero', () => {
    expect(humanizeGain(0.8, 9, 0)).toBe(0.8);
    expect(timingSway(9, 0)).toBe(0);
  });
});

describe('drum patterns (data-driven, mirrors DrumProvider)', () => {
  it('pop8 has kick on 1/3, snare on 2/4, and 8th hats', () => {
    const hits = getDrumPattern('pop8').hits;
    expect(hits.filter((h) => h.voice === 'kick').map((h) => h.beat)).toEqual([0, 2]);
    expect(hits.filter((h) => h.voice === 'snare').map((h) => h.beat)).toEqual([1, 3]);
    expect(hits.filter((h) => h.voice === 'hatClosed')).toHaveLength(8);
  });

  it('soul16 tags ghost snares', () => {
    const ghosts = getDrumPattern('soul16').hits.filter((h) => h.tags?.includes('ghost'));
    expect(ghosts.map((h) => h.beat)).toEqual([1.75, 3.75]);
    expect(ghosts.every((h) => h.vel === 0.3)).toBe(true);
  });

  it('jazzSwing places off-beat rides at +2/3', () => {
    const rides = getDrumPattern('jazzSwing').hits.filter((h) => h.voice === 'ride');
    expect(rides.some((h) => Math.abs(h.beat - (1 + 2 / 3)) < 1e-9)).toBe(true);
    expect(rides.some((h) => Math.abs(h.beat - (3 + 2 / 3)) < 1e-9)).toBe(true);
  });
});

describe('piano pattern structure', () => {
  it('eightBeat locks bass to quarters and body to 8ths', () => {
    const bass = gridOnsetBeats('eightBeat', 4, 'bass');
    const body = gridOnsetBeats('eightBeat', 4, 'body');
    expect(bass.map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(body).toHaveLength(8);
    expect(body.filter((s) => (s.look ?? 0) > 0).length).toBeGreaterThan(0);
  });

  it('sixteenthBeat body has 16 slots with ghost e-slots', () => {
    const body = gridOnsetBeats('sixteenthBeat', 4, 'body');
    expect(body).toHaveLength(16);
    const ghosts = body.filter((s) => s.vel < 0.5);
    expect(ghosts.length).toBe(4);
  });
});

describe('compilePianoStrikes', () => {
  const base = {
    bpm: 120,
    sampleRate: 44100,
    totalBeats: 8,
    events: sampleEvents,
  };

  it('is deterministic for eightBeat', () => {
    const a = compilePianoStrikes({ ...base, patternId: 'eightBeat' });
    const b = compilePianoStrikes({ ...base, patternId: 'eightBeat' });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it('block emits strikes near each chord start (including sparkle)', () => {
    const strikes = compilePianoStrikes({ ...base, patternId: 'block' });
    // 2 chords × (5 notes + 1 sparkle) with strum offsets
    expect(strikes.length).toBe(12);
    const starts = [...new Set(strikes.map((s) => s.startFrame))].sort((a, b) => a - b);
    expect(starts[0]).toBe(0);
    // second chord at beat 4 → frame = 4 * (44100*60/120) = 88200
    expect(starts).toContain(88200);
  });

  it('eightBeat includes bass notes below 48 and body notes at/above 48', () => {
    const strikes = compilePianoStrikes({ ...base, patternId: 'eightBeat' });
    expect(strikes.some((s) => s.note < 48)).toBe(true);
    expect(strikes.some((s) => s.note >= 48)).toBe(true);
  });

  it('arpeggio produces single-note body steps', () => {
    const strikes = compilePianoStrikes({ ...base, patternId: 'arpeggio' });
    const body = strikes.filter((s) => s.note >= 48);
    expect(body.length).toBeGreaterThan(8);
    // most body hits are one note at a time (no strum cluster at same frame with many notes)
    const byFrame = new Map<number, number>();
    for (const s of body) byFrame.set(s.startFrame, (byFrame.get(s.startFrame) ?? 0) + 1);
    const multi = [...byFrame.values()].filter((n) => n > 1);
    expect(multi.length).toBe(0);
  });

  it('beat-level compile is deterministic and SR-independent', () => {
    const a = compilePianoBeatStrikes({
      bpm: 120,
      totalBeats: 8,
      events: sampleEvents,
      patternId: 'eightBeat',
    });
    const b = compilePianoBeatStrikes({
      bpm: 120,
      totalBeats: 8,
      events: sampleEvents,
      patternId: 'eightBeat',
    });
    expect(a).toEqual(b);
    expect(a[0]).toEqual(
      expect.objectContaining({
        startBeat: expect.any(Number),
        durationBeats: expect.any(Number),
        note: expect.any(Number),
        gain: expect.any(Number),
      }),
    );
  });
});

describe('grooveProfileFor', () => {
  it('covers every product groove × accompaniment without phrase payloads', () => {
    for (const g of PRODUCT_GROOVE_IDS) {
      for (const a of PRODUCT_ACCOMPANIMENT_IDS) {
        const p = grooveProfileFor(g, a);
        expect(p.id).toBe(`${g}__${a}`);
        expect(p.pianoPatternId).toBe(a);
        expect(p.drumPatternId).toBe(g);
        expect(p.source.type).toBe('handcrafted');
        expect(p.features.pedalStyle).toBe('ringCap');
        // Copy-guard: profiles must not embed note arrays
        expect(JSON.stringify(p)).not.toMatch(/"midiNotes"/);
      }
    }
  });

  it('marks jazzSwing with swing ratio 2/3', () => {
    expect(grooveProfileFor('jazzSwing', 'block').features.swingRatio).toBeCloseTo(2 / 3);
    expect(grooveProfileFor('pop8', 'block').features.swingRatio).toBe(0.5);
  });
});
