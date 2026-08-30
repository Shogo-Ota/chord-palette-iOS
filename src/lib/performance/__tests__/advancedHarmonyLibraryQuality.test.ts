import {
  chromaticMediantChords,
  passingDiminishedChords,
  substituteChords,
} from '@/data/advancedHarmonyChords';
import { MAJOR_KEYS, secondaryDominants } from '@/data/music';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordEvent, KeyMode, LibraryChord, MajorKey } from '@/types';

function eventFrom(chord: LibraryChord, mode: KeyMode): ChordEvent {
  return {
    id: `advanced-quality-${chord.id}`,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: chord.isPro ?? false,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    rootSpelling: chord.rootSpelling,
    category: chord.category,
    modeContext: mode,
  };
}

function qualityFor(key: MajorKey, mode: KeyMode, chord: LibraryChord) {
  const input: PerformanceSessionInput = {
    key,
    tempoBpm: 100,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: 'natural.type1',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: [eventFrom(chord, mode)],
  };
  const plan = buildSessionPerformancePlan(input, 'pro');
  return {
    chordNotes: plan.notes.filter((note) => note.trackId === 'chord').length,
    violations: plan.harmonyViolations ?? [],
    rejects: plan.collisionReport?.rejects ?? [],
  };
}

describe('advanced harmony library shipping quality', () => {
  it('keeps every major advanced card audible and collision-clean in all keys', () => {
    const failures: unknown[] = [];

    for (const key of MAJOR_KEYS) {
      const cards = [
        ...secondaryDominants(key),
        ...passingDiminishedChords(key),
        ...substituteChords(key, 'major'),
        ...chromaticMediantChords(key),
      ];
      for (const chord of cards) {
        const quality = qualityFor(key, 'major', chord);
        if (
          quality.chordNotes === 0 ||
          quality.violations.length > 0 ||
          quality.rejects.length > 0
        ) {
          failures.push({ key, chord: chord.displayName, quality });
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps the conservative minor SubV7 audible and collision-clean in all keys', () => {
    const failures: unknown[] = [];

    for (const key of MAJOR_KEYS) {
      for (const chord of substituteChords(key, 'minor')) {
        const quality = qualityFor(key, 'minor', chord);
        if (
          quality.chordNotes === 0 ||
          quality.violations.length > 0 ||
          quality.rejects.length > 0
        ) {
          failures.push({ key, chord: chord.displayName, quality });
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
