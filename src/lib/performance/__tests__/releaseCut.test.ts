import { applyReleaseCut } from '@/lib/performance/releaseCut';
import type { NoteEvent } from '@/lib/performance/NoteEvent';

function note(
  partial: Pick<NoteEvent, 'trackId' | 'durationBeat'> & Partial<NoteEvent>,
): NoteEvent {
  return {
    timeBeat: 0,
    pitch: 60,
    velocity: 80,
    articulation: 'normal',
    rrIndex: 0,
    seed: 1,
    ...partial,
  };
}

describe('applyReleaseCut', () => {
  const mixed: NoteEvent[] = [
    note({ trackId: 'chord', durationBeat: 0.5 }),
    note({ trackId: 'bass', durationBeat: 0.4 }),
    note({ trackId: 'top', durationBeat: 0.3 }),
    note({ trackId: 'kick', durationBeat: 0.2 }),
    note({ trackId: 'snare', durationBeat: 0.15 }),
    note({ trackId: 'hat', durationBeat: 0.1 }),
  ];

  it('returns the same array reference when releaseCut is on (identity)', () => {
    expect(applyReleaseCut(mixed, true)).toBe(mixed);
  });

  it('extends chord/bass/top durations when releaseCut is off', () => {
    const out = applyReleaseCut(mixed, false);
    expect(out).not.toBe(mixed);
    const chord = out.find((e) => e.trackId === 'chord')!;
    const bass = out.find((e) => e.trackId === 'bass')!;
    const top = out.find((e) => e.trackId === 'top')!;
    expect(chord.durationBeat).toBeGreaterThan(0.5);
    expect(bass.durationBeat).toBeGreaterThan(0.4);
    expect(top.durationBeat).toBeGreaterThan(0.3);
  });

  it('never touches drum track durations', () => {
    const out = applyReleaseCut(mixed, false);
    expect(out.find((e) => e.trackId === 'kick')!.durationBeat).toBe(0.2);
    expect(out.find((e) => e.trackId === 'snare')!.durationBeat).toBe(0.15);
    expect(out.find((e) => e.trackId === 'hat')!.durationBeat).toBe(0.1);
  });

  it('caps extended duration so notes do not hang forever', () => {
    const long = [note({ trackId: 'chord', durationBeat: 2.0 })];
    const out = applyReleaseCut(long, false);
    expect(out[0].durationBeat).toBeLessThanOrEqual(2.5);
  });
});
