/**
 * Drum controls: mode (off / clap / full) × Full subdivision (8 / 16 / 3).
 * Clap is always backbeat 2 & 4 — no beat chips, no extra takes.
 */

import { drumHitsForGroove, DRUM_GROOVE_IDS, gmDrumNote } from '@/lib/drum/drumKit';
import { DRUM_BEAT_IDS, normalizeDrumBeat, type DrumBeat } from '@/lib/drum/drumBeat';
import { DEFAULT_DRUM_MODE, normalizeDrumMode } from '@/lib/drum/drumMode';
import { resolveDrumPatternId } from '@/lib/drum/resolveDrumPattern';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordEvent } from '@/types';

const PROGRESSION = [0, 7, 9, 5].map(
  (rootOffset, i) =>
    ({
      id: `ev${i}`,
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
    tempoBpm: 100,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 1,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'full',
    drumBeat: '8',
    progression: PROGRESSION,
    ...overrides,
  };
}

function drumNotes(overrides: Partial<PerformanceSessionInput>) {
  const plan = buildSessionPerformancePlan(session(overrides));
  return buildFinalMidiSnapshot(plan).notes.filter((n) => n.track === 'drums');
}

describe('drum subdivision resolves to a real native kit', () => {
  it.each(DRUM_BEAT_IDS)('%s maps to a kit the engine ships', (beat) => {
    const id = resolveDrumPatternId({
      grooveId: 'pop8',
      accompanimentPattern: 'natural',
      drumBeat: beat,
      drumMode: 'full',
    });
    expect(DRUM_GROOVE_IDS).toContain(id);
    expect(drumHitsForGroove(id).length).toBeGreaterThan(0);
  });

  it('gives each Full subdivision a distinct kit', () => {
    const ids = DRUM_BEAT_IDS.map((beat) =>
      resolveDrumPatternId({
        grooveId: 'pop8',
        accompanimentPattern: 'natural',
        drumBeat: beat,
        drumMode: 'full',
      }),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lets a rhythm that owns its meter or hop keep its kit in Full mode', () => {
    for (const pattern of ['waltz', 'sixEight', 'shuffle', 'swing', 'reggae']) {
      for (const beat of DRUM_BEAT_IDS) {
        expect(
          resolveDrumPatternId({
            grooveId: 'pop8',
            accompanimentPattern: pattern,
            drumBeat: beat,
            drumMode: 'full',
          }),
        ).toBe(pattern);
      }
    }
  });

  it('defaults to the 8th-note kit when no subdivision is stored', () => {
    expect(normalizeDrumBeat(undefined)).toBe('8');
    expect(normalizeDrumBeat('4')).toBe('8');
    expect(resolveDrumPatternId({ grooveId: 'pop8', accompanimentPattern: 'natural' })).toBe(
      resolveDrumPatternId({
        grooveId: 'pop8',
        accompanimentPattern: 'natural',
        drumBeat: '8',
        drumMode: 'full',
      }),
    );
  });
});

describe('drum mode decides which voices sound', () => {
  const CLAP = gmDrumNote('clap');
  const KICK = gmDrumNote('kick');

  it('defaults to clap (backbeat)', () => {
    expect(DEFAULT_DRUM_MODE).toBe('clap');
    expect(normalizeDrumMode('kick')).toBe('clap');
  });

  it('off generates no drum note at all', () => {
    for (const drumBeat of DRUM_BEAT_IDS) {
      expect(drumNotes({ drumMode: 'off', drumBeat })).toHaveLength(0);
    }
  });

  it('clap is always backbeat 2 & 4, regardless of subdivision', () => {
    const shapes = new Set(
      DRUM_BEAT_IDS.map((drumBeat) =>
        drumNotes({ drumMode: 'clap', drumBeat })
          .map((n) => `${n.startBeat.toFixed(3)}:${n.pitch}`)
          .join(','),
      ),
    );
    expect(shapes.size).toBe(1);

    const notes = drumNotes({ drumMode: 'clap', drumBeat: '8' });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.pitch === CLAP)).toBe(true);
    const firstBar = notes.filter((n) => n.startBeat < 4);
    expect(firstBar.map((n) => n.startBeat)).toEqual([1, 3]);
  });

  it('clap mode ignores accompaniment-owned kits', () => {
    expect(
      resolveDrumPatternId({
        grooveId: 'pop8',
        accompanimentPattern: 'waltz',
        drumBeat: '8',
        drumMode: 'clap',
      }),
    ).toBe('clap');
  });

  it('full brings in voices beyond the clap', () => {
    for (const drumBeat of DRUM_BEAT_IDS) {
      const notes = drumNotes({ drumMode: 'full', drumBeat });
      expect(notes.some((n) => n.pitch === KICK)).toBe(true);
      expect(notes.some((n) => n.pitch !== CLAP && n.pitch !== KICK)).toBe(true);
    }
  });

  it('each Full subdivision plays a different kit', () => {
    const shapes = new Set(
      DRUM_BEAT_IDS.map((drumBeat) =>
        drumNotes({ drumMode: 'full', drumBeat })
          .map((n) => `${n.startBeat.toFixed(3)}:${n.pitch}`)
          .join(','),
      ),
    );
    expect(shapes.size).toBe(DRUM_BEAT_IDS.length);
  });

  it('subdivision does not change the accompaniment, only the kit', () => {
    const accompOf = (drumBeat: DrumBeat) =>
      buildFinalMidiSnapshot(buildSessionPerformancePlan(session({ drumBeat })))
        .notes.filter((n) => n.track === 'accompaniment')
        .map((n) => `${n.startBeat}:${n.pitch}:${n.velocity}`)
        .join('|');
    expect(accompOf('3')).toBe(accompOf('8'));
    expect(accompOf('16')).toBe(accompOf('8'));
  });
});
