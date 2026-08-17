import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor } from '@/lib/performance/variants';
import type { ChordEvent } from '@/types';

const EPS = 0.05;

function chord(
  index: number,
  rootOffset: number,
  suffix: string,
  durationBeats: 1 | 2 | 4,
): ChordEvent {
  return {
    id: `short-${index}`,
    chordId: `short-${index}`,
    displayName: `${rootOffset}${suffix}`,
    degreeLabel: '',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
  };
}

const MIXED_SHORT_PROGRESSION = [
  chord(0, 0, '', 1),
  chord(1, 7, '7', 1),
  chord(2, 9, 'm7', 2),
  chord(3, 5, 'maj7', 1),
  chord(4, 7, '', 2),
  chord(5, 0, 'add9', 4),
] as const;

function session(
  pattern: (typeof PUBLIC_ACCOMPANIMENT_PATTERNS)[number],
  tempoBpm: number,
): PerformanceSessionInput {
  return {
    key: 'C',
    tempoBpm,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: defaultVariantFor(pattern).id,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'off',
    drumMode: 'off',
    progression: [...MIXED_SHORT_PROGRESSION],
  };
}

function onsetKey(beat: number): string {
  return (Math.round(beat * 480) / 480).toFixed(6);
}

describe('Production short-chord duration contract', () => {
  it.each(
    [90, 132].flatMap((tempoBpm) =>
      PUBLIC_ACCOMPANIMENT_PATTERNS.filter((pattern) => pattern !== 'natural').map((pattern) => ({
        tempoBpm,
        pattern,
      })),
    ),
  )(
    '$pattern keeps 1/4-, 1/2- and full-bar chords intact at $tempoBpm BPM',
    ({ tempoBpm, pattern }) => {
      const plan = buildSessionPerformancePlan(session(pattern, tempoBpm));
      expect(plan.harmonyViolations).toEqual([]);

      for (const chordWindow of plan.chords) {
        const start = chordWindow.startBeat;
        const end = start + chordWindow.durationBeats;
        const notes = plan.notes.filter(
          (note) => note.timeBeat >= start - EPS && note.timeBeat < end - 1e-9,
        );
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.some((note) => note.trackId === 'chord' || note.trackId === 'top')).toBe(true);
        expect(notes.every((note) => note.durationBeat > 0)).toBe(true);
        expect(notes.every((note) => note.timeBeat < end)).toBe(true);

        const duplicateKeys = notes.map((note) => `${onsetKey(note.timeBeat)}:${note.pitch}`);
        expect(new Set(duplicateKeys).size).toBe(duplicateKeys.length);
      }
    },
  );

  it.each([90, 132])(
    'Natural keeps 1/4-, 1/2- and full-bar chords intact at %i BPM',
    (tempoBpm) => {
      const plan = buildSessionPerformancePlan(session('natural', tempoBpm));
      const snapshot = buildFinalMidiSnapshot(plan);
      expect(plan.harmonyViolations).toEqual([]);

      for (const chordWindow of plan.chords) {
        const start = chordWindow.startBeat;
        const end = start + chordWindow.durationBeats;
        const notes = plan.notes.filter(
          (note) => note.timeBeat >= start - EPS && note.timeBeat < end - 1e-9,
        );
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.some((note) => note.trackId === 'chord' || note.trackId === 'top')).toBe(true);
        expect(notes.every((note) => note.durationBeat > 0)).toBe(true);
        expect(notes.every((note) => note.timeBeat < end)).toBe(true);
        expect(notes.every((note) => note.timeBeat + note.durationBeat <= end + EPS)).toBe(true);
        expect(new Set(notes.map((note) => onsetKey(note.timeBeat))).size).toBeLessThanOrEqual(
          chordWindow.durationBeats * 2,
        );
        expect(new Set(notes.map((note) => `${onsetKey(note.timeBeat)}:${note.pitch}`)).size).toBe(
          notes.length,
        );
        if (chordWindow.durationBeats < 4) {
          const pedalAtBoundary = snapshot.controlChanges
            .filter((event) => event.controller === 64 && event.startBeat <= end + 1e-9)
            .at(-1);
          expect(pedalAtBoundary?.value ?? 0).toBeLessThan(64);
        }
      }
    },
  );
});
