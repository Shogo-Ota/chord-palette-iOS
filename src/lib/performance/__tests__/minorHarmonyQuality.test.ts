/**
 * Shipping gate for the minor editor inventory.
 *
 * UI availability is not enough: every card added by the minor providers must survive
 * the same compact.v3 collision contract as the established major library.
 */
import { diatonicLibrary, diatonicSeventhLibrary, MAJOR_KEYS } from '@/data/music';
import { minorPrimaryDominants } from '@/data/minorAdvancedChords';
import {
  minorAlteredVariations,
  minorAvailableVariations,
  minorExtendedVariations,
  minorVariationChord,
} from '@/data/minorVariations';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordEvent, LibraryChord, MajorKey } from '@/types';

function eventFrom(chord: LibraryChord): ChordEvent {
  return {
    id: `quality-${chord.id}`,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: chord.isPro ?? false,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    category: chord.category,
    modeContext: 'minor',
  };
}

function rejectsFor(key: MajorKey, chord: LibraryChord): string[] {
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
    progression: [eventFrom(chord)],
  };
  return buildSessionPerformancePlan(input, 'pro').collisionReport!.rejects.map(
    (reject) => reject.ruleId,
  );
}

describe('minor harmony quality gate', () => {
  it('keeps the basic seven and their sevenths collision-clean in all 12 keys', () => {
    const failures: { key: MajorKey; chord: string; rejects: string[] }[] = [];

    for (const key of MAJOR_KEYS) {
      const chords = [...diatonicLibrary(key, 'minor'), ...diatonicSeventhLibrary(key, 'minor')];
      for (const chord of chords) {
        const rejects = rejectsFor(key, chord);
        if (rejects.length > 0) failures.push({ key, chord: chord.displayName, rejects });
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps every minor primary-dominant form collision-clean in all 12 keys', () => {
    const failures: { key: MajorKey; chord: string; rejects: string[] }[] = [];

    for (const key of MAJOR_KEYS) {
      for (const chord of minorPrimaryDominants(key)) {
        const rejects = rejectsFor(key, chord);
        if (rejects.length > 0) failures.push({ key, chord: chord.displayName, rejects });
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps every C-minor variation collision-clean, including disclosed avoid colours', () => {
    const failures: { chord: string; rejects: string[] }[] = [];

    for (let degree = 0; degree < 7; degree += 1) {
      const ids = [
        ...minorAvailableVariations(degree),
        ...minorExtendedVariations(degree),
        ...minorAlteredVariations(degree),
      ];
      for (const id of ids) {
        const chord = minorVariationChord('C', degree, id);
        const rejects = rejectsFor('C', chord);
        if (rejects.length > 0) failures.push({ chord: chord.displayName, rejects });
      }
    }

    expect(failures).toEqual([]);
  });
});
