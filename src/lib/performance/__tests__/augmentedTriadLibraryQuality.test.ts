import { augmentedTriads } from '@/data/augmentedTriads';
import { keyTonicPc } from '@/data/music';
import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  validateFinalMidiSnapshot,
  validateSmfBytes,
  writeSmf,
} from '@/lib/midiExport';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordEvent, KeyMode, LibraryChord, MajorKey } from '@/types';

const MODES: readonly KeyMode[] = ['major', 'minor'];
const ALLOWED_INTERVALS = new Set([0, 4, 8]);

function eventFrom(chord: LibraryChord, key: MajorKey, mode: KeyMode): ChordEvent {
  return {
    id: `aug-quality-${key}-${mode}`,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: true,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    rootSpelling: chord.rootSpelling,
    category: chord.category,
    keyContext: key,
    modeContext: mode,
    voicingPosition: 'root',
  };
}

function sessionInput(
  key: MajorKey,
  mode: KeyMode,
  chord: LibraryChord,
): PerformanceSessionInput {
  return {
    key,
    tempoBpm: 100,
    grooveId: 'pop8',
    accompanimentPattern: 'block',
    accompanimentVariant: 'block.type1',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'off',
    drumMode: 'off',
    progression: [eventFrom(chord, key, mode)],
  };
}

function relativePitchClass(key: MajorKey, rootOffset: number, pitch: number): number {
  return ((pitch - keyTonicPc(key) - rootOffset) % 12 + 12) % 12;
}

describe('Augmented Triad shipping quality', () => {
  it('keeps all 12 roots in both modes audible, legal, #5-complete, and collision-clean', () => {
    const failures: unknown[] = [];
    const key: MajorKey = 'C';

    for (const mode of MODES) {
      for (const chord of augmentedTriads(key, mode)) {
        const plan = buildSessionPerformancePlan(sessionInput(key, mode, chord), 'pro');
        const accompaniment = plan.notes.filter((note) => note.trackId === 'chord');
        const pitchClasses = accompaniment.map((note) =>
          relativePitchClass(key, chord.rootOffset, note.pitch),
        );

        if (
          accompaniment.length === 0 ||
          !pitchClasses.includes(8) ||
          pitchClasses.some((pitchClass) => !ALLOWED_INTERVALS.has(pitchClass)) ||
          (plan.harmonyViolations?.length ?? 0) > 0 ||
          (plan.collisionReport?.rejects.length ?? 0) > 0
        ) {
          failures.push({
            key,
            mode,
            chord: chord.displayName,
            pitchClasses,
            violations: plan.harmonyViolations,
            rejects: plan.collisionReport?.rejects,
          });
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('writes a valid parseable SMF from the same Final MIDI plan', () => {
    const key: MajorKey = 'C';

    for (const mode of MODES) {
      for (const chord of augmentedTriads(key, mode)) {
        const plan = buildSessionPerformancePlan(sessionInput(key, mode, chord), 'pro');
        const snapshot = buildFinalMidiSnapshot(plan);
        const bytes = writeSmf(snapshot);
        const parsed = parseSmf(bytes);
        const accompaniment = snapshot.notes.filter((note) => note.track === 'accompaniment');
        const pitchClasses = accompaniment.map((note) =>
          relativePitchClass(key, chord.rootOffset, note.pitch),
        );

        expect(validateFinalMidiSnapshot(snapshot, plan).ok).toBe(true);
        expect(validateSmfBytes(snapshot).ok).toBe(true);
        expect(parsed.notes.length).toBeGreaterThan(0);
        expect(new Set(pitchClasses)).toEqual(new Set([0, 4, 8]));
        expect(snapshot.markers.map((marker) => marker.label)).toEqual([chord.displayName]);
      }
    }
  });
});
