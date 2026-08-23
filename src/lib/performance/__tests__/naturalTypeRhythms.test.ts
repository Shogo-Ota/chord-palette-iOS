import { goldenProgressionById } from '@/lib/midiQa/goldenProgressions';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';

const EXPECTED = {
  'natural.type1': [
    [0, 1, 1.5, 2.5, 3],
    [0, 1, 1.5, 2.5, 3],
    [0, 1, 1.5, 2.5, 3],
    [0, 1, 1.5, 2.5, 3],
  ],
  'natural.type2': [
    [0, 1, 1.5, 2, 3, 3.5],
    [0, 1, 1.5, 2, 3, 3.5],
    [0, 1, 1.5, 2, 3, 3.5],
    [0, 1, 1.5, 2, 3, 3.5],
  ],
  'natural.type3': [
    [0, 0.75, 0.98, 1.5, 2.25, 2.5, 3, 3.25, 3.75],
    [0, 1, 1.5, 2, 2.25, 2.5, 3, 3.25, 3.75],
    [0, 0.75, 0.98, 1.5, 2.25, 2.5, 3, 3.25, 3.75],
    [0, 1, 1.25, 1.5, 1.75, 2.5, 3, 3.5],
  ],
  'natural.type4': [
    [0, 0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.25, 3.5, 3.75],
    [0, 0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.25, 3.5, 3.75],
    [0, 0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.25, 3.5, 3.75],
    [0, 0.5, 1, 1.5, 1.75, 2, 2.5, 3, 3.5, 3.75],
  ],
  'natural.type5': [
    [0, 0.5, 1, 1.5, 2.5, 3, 3.5],
    [0, 0.5, 1, 1.5, 2.5, 3, 3.5],
    [0, 0.5, 1, 1.5, 2.5, 3, 3.5],
    [0, 0.5, 1, 1.5, 2.5, 3, 3.5],
  ],
} as const;

function plan(variant: keyof typeof EXPECTED) {
  const progression = goldenProgressionById('A');
  const session: PerformanceSessionInput = {
    key: progression.key,
    tempoBpm: 100,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: variant,
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    octaveShift: 0,
    voicingPosition: 'root',
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: progression.chords,
  };
  return buildSessionPerformancePlan(session, 'free');
}

describe('Natural public Type rhythm identity', () => {
  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])(
    '%s emits its exact authored attack groups',
    (variant) => {
      const rendered = plan(variant);
      rendered.chords.forEach((chord, chordIndex) => {
        const onsets = [
          ...new Set(
            rendered.notes
              .filter(
                (note) =>
                  note.trackId === 'chord' &&
                  note.timeBeat >= chord.startBeat - 1e-9 &&
                  note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
              )
              .map((note) => Number((note.timeBeat - chord.startBeat).toFixed(6))),
          ),
        ].sort((left, right) => left - right);
        expect(onsets).toEqual(EXPECTED[variant][chordIndex]);
      });
    },
  );

  it('keeps the five public Types observably distinct', () => {
    const signatures = (Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]).map((variant) =>
      plan(variant)
        .notes.filter((note) => note.trackId === 'chord')
        .map((note) => `${note.timeBeat}:${note.durationBeat}`)
        .join('|'),
    );
    expect(new Set(signatures).size).toBe(5);
  });

  it('keeps every Type5 attack subtractive and strictly single-note', () => {
    const rendered = plan('natural.type5');
    rendered.chords.forEach((chord) => {
      const notes = rendered.notes.filter(
        (note) =>
          note.trackId === 'chord' &&
          note.timeBeat >= chord.startBeat - 1e-9 &&
          note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
      );
      const counts = new Map<number, number>();
      for (const note of notes) counts.set(note.timeBeat, (counts.get(note.timeBeat) ?? 0) + 1);
      expect([...counts.values()].every((count) => count === 1)).toBe(true);
      expect(new Set(notes.map((note) => note.pitch)).size).toBeGreaterThanOrEqual(3);
      const pitches = [...notes]
        .sort((left, right) => left.timeBeat - right.timeBeat)
        .map((note) => note.pitch);
      expect(
        pitches.slice(0, 4).every((pitch, index) => index === 0 || pitch > pitches[index - 1]!),
      ).toBe(true);
      expect(
        pitches.slice(4).every((pitch, index, half) => index === 0 || pitch < half[index - 1]!),
      ).toBe(true);
    });
  });

  it('uses controlled Type2/Driving/Arpeggio pedal while keeping Funk pedal-free', () => {
    const type2 = plan('natural.type2');
    const type2Cc64 = buildFinalMidiSnapshot(type2).controlChanges;
    expect(type2Cc64.slice(0, 2).map((event) => [event.startBeat, event.value])).toEqual([
      [0, 96],
      [3.9, 0],
    ]);
    for (const chord of type2.chords) {
      const atBoundary = type2Cc64.filter(
        (event) => Math.abs(event.startBeat - (chord.startBeat + chord.durationBeats)) <= 1e-9,
      );
      expect(atBoundary.some((event) => event.value === 0)).toBe(true);
    }

    expect(buildFinalMidiSnapshot(plan('natural.type4')).controlChanges.length).toBeGreaterThan(0);
    expect(buildFinalMidiSnapshot(plan('natural.type5')).controlChanges.length).toBeGreaterThan(0);
    expect(buildFinalMidiSnapshot(plan('natural.type3')).controlChanges).toEqual([]);
    expect(
      buildFinalMidiSnapshot(plan('natural.type1')).controlChanges.some(
        (event) => event.controller === 64,
      ),
    ).toBe(true);
  });
});
