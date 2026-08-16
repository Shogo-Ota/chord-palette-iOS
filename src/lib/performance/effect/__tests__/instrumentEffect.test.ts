/**
 * The piano effect may lengthen or shorten a note and nothing else. Pitch, onset,
 * velocity, articulation and the number of notes must survive all three readings —
 * the groove is the teacher's, only the ring is the user's.
 */

import {
  applyInstrumentEffect,
  instrumentEffectFromReleaseCut,
  INSTRUMENT_EFFECT_IDS,
  normalizeInstrumentEffect,
} from '@/lib/performance/effect';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { ChordEvent } from '@/types';

function note(overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    timeBeat: 0,
    durationBeat: 1,
    pitch: 60,
    velocity: 80,
    articulation: 'normal',
    rrIndex: 0,
    trackId: 'chord',
    seed: 1,
    ...overrides,
  } as NoteEvent;
}

const PROGRESSION: ChordEvent[] = [0, 5, 9, 7].map(
  (rootOffset, i) =>
    ({
      id: `e${i}`,
      chordId: `c${i}`,
      displayName: `c${i}`,
      degreeLabel: 'I',
      function: 'tonic',
      durationBeats: 4,
      isPro: false,
      rootOffset,
      suffix: '',
    }) as ChordEvent,
);

function session(overrides: Partial<PerformanceSessionInput> = {}): PerformanceSessionInput {
  return {
    key: 'C',
    tempoBpm: 88,
    grooveId: 'pop8',
    accompanimentPattern: 'relaxed',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 1,
    releaseCut: true,
    drumMode: 'full',
    drumBeat: '8',
    progression: PROGRESSION,
    ...overrides,
  };
}

describe('applyInstrumentEffect', () => {
  const notes = [
    note({ timeBeat: 0, durationBeat: 1, pitch: 60 }),
    note({ timeBeat: 1, durationBeat: 0.5, pitch: 64, trackId: 'top' }),
    note({ timeBeat: 2, durationBeat: 2, pitch: 43, trackId: 'bass' }),
    note({ timeBeat: 0, durationBeat: 0.25, pitch: 36, trackId: 'kick', velocity: 110 }),
  ];

  it('off returns the performance untouched', () => {
    expect(applyInstrumentEffect(notes, 'off')).toBe(notes);
  });

  it('sustain rings through CC64 rather than stretching lengths; release cut shortens', () => {
    const sustained = applyInstrumentEffect(notes, 'sustain');
    const cut = applyInstrumentEffect(notes, 'releaseCut');
    expect(sustained.map((n) => n.durationBeat)).toEqual(notes.map((n) => n.durationBeat));
    expect(cut[0]!.durationBeat).toBeLessThan(notes[0]!.durationBeat);
  });

  it.each(INSTRUMENT_EFFECT_IDS)('%s changes nothing but the length', (effect) => {
    const out = applyInstrumentEffect(notes, effect);
    expect(out).toHaveLength(notes.length);
    out.forEach((n, i) => {
      const raw = notes[i]!;
      expect(n.pitch).toBe(raw.pitch);
      expect(n.timeBeat).toBe(raw.timeBeat);
      expect(n.velocity).toBe(raw.velocity);
      expect(n.articulation).toBe(raw.articulation);
      expect(n.trackId).toBe(raw.trackId);
    });
  });

  it('never touches a drum voice', () => {
    for (const effect of INSTRUMENT_EFFECT_IDS) {
      const kick = applyInstrumentEffect(notes, effect).find((n) => n.trackId === 'kick')!;
      expect(kick.durationBeat).toBe(0.25);
    }
  });

  it('keeps a cut note audible rather than clicking', () => {
    const tiny = [note({ durationBeat: 0.05 })];
    expect(applyInstrumentEffect(tiny, 'releaseCut')[0]!.durationBeat).toBeGreaterThanOrEqual(0.05);
  });

  it('reads a project saved with the old 余韻 flag', () => {
    expect(instrumentEffectFromReleaseCut(true)).toBe('releaseCut');
    expect(instrumentEffectFromReleaseCut(false)).toBe('sustain');
    expect(normalizeInstrumentEffect('off')).toBe('sustain');
    expect(normalizeInstrumentEffect('garbage')).toBe('sustain');
  });
});

describe('the effect through the production pipeline', () => {
  it('leaves pitch, onset and velocity identical across all three effects', () => {
    const shape = (effect: 'off' | 'sustain' | 'releaseCut') =>
      buildSessionPerformancePlan(session({ instrumentEffect: effect })).notes.map(
        (n) => `${n.timeBeat}:${n.pitch}:${n.velocity}:${n.trackId}`,
      );
    expect(shape('sustain')).toEqual(shape('off'));
    expect(shape('releaseCut')).toEqual(shape('off'));
  });

  it('writes the teacher pedal once for sustain, and not at all for a release cut', () => {
    const cc = (effect: 'off' | 'sustain' | 'releaseCut') =>
      buildFinalMidiSnapshot(
        buildSessionPerformancePlan(session({ instrumentEffect: effect })),
      ).controlChanges.filter((c) => c.controller === 64);
    // The pedal is the ring, and it stays exactly as the teacher played it.
    expect(cc('sustain')).toEqual(cc('off'));
    expect(cc('releaseCut')).toHaveLength(0);
  });

  it('falls back to the legacy flag when no effect is stored', () => {
    const legacyRing = buildSessionPerformancePlan(session({ releaseCut: false }));
    const sustained = buildSessionPerformancePlan(session({ instrumentEffect: 'sustain' }));
    expect(legacyRing.instrumentEffect).toBe('sustain');
    expect(legacyRing.notes.map((n) => n.durationBeat)).toEqual(
      sustained.notes.map((n) => n.durationBeat),
    );
  });
});
