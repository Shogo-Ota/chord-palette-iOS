import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { humanTemplateById } from '@/lib/performance/humanTemplate';
import { naturalPedalEvents } from '@/lib/performance/naturalAtomic/pedalPolicy';
import type { ChordDuration } from '@/types';

function plan(
  variant: 'natural.type1' | 'natural.type2' | 'natural.type3' | 'natural.type4' | 'natural.type5',
  durations: readonly ChordDuration[] = [4, 4, 4, 4],
) {
  const source = GOLDEN_PROGRESSIONS[0]!;
  return buildSessionPerformancePlan({
    key: source.key,
    tempoBpm: source.bpm,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: variant,
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: source.chords.map((chord, index) => ({
      ...chord,
      durationBeats: durations[index % durations.length]!,
    })),
  });
}

function eventsFor(source: ReturnType<typeof plan>) {
  const template = humanTemplateById(source.humanTemplateId!);
  if (!template) throw new Error(`missing template ${source.humanTemplateId}`);
  return naturalPedalEvents(template, source.chords, source.accompanimentVariant);
}

describe('Natural pedal policy', () => {
  it('holds Type2 through the chord and releases before the next boundary', () => {
    expect(
      eventsFor(plan('natural.type2'))
        .slice(0, 2)
        .map((event) => [event.startBeat, event.value]),
    ).toEqual([
      [0, 96],
      [3.9, 0],
    ]);
  });

  it('holds each Driving turn through its final single note', () => {
    expect(
      eventsFor(plan('natural.type4'))
        .slice(0, 8)
        .map((event) => [event.startBeat, event.value]),
    ).toEqual([
      [0, 92],
      [0.82, 0],
      [1, 92],
      [1.95, 0],
      [2, 92],
      [2.82, 0],
      [3, 92],
      [3.95, 0],
    ]);
  });

  it('holds Arpeggio resonance through the apex gap and releases before the boundary', () => {
    expect(
      eventsFor(plan('natural.type5'))
        .slice(0, 2)
        .map((event) => [event.startBeat, event.value]),
    ).toEqual([
      [0, 96],
      [3.9, 0],
    ]);
  });

  it('forces Pedal Up at every short-chord boundary', () => {
    for (const variant of ['natural.type2', 'natural.type4', 'natural.type5'] as const) {
      const source = plan(variant, [1, 2, 1, 2]);
      const events = eventsFor(source);
      for (const chord of source.chords) {
        const end = chord.startBeat + chord.durationBeats;
        expect(
          events.some((event) => Math.abs(event.startBeat - end) <= 1e-9 && event.value === 0),
        ).toBe(true);
        expect(
          events
            .filter(
              (event) => event.startBeat >= chord.startBeat - 1e-9 && event.startBeat <= end + 1e-9,
            )
            .every((event) => event.startBeat <= end + 1e-9),
        ).toBe(true);
      }
    }
  });

  it('retains Type1 teacher pedal and keeps Funk pedal-free', () => {
    expect(eventsFor(plan('natural.type1')).length).toBeGreaterThan(0);
    expect(eventsFor(plan('natural.type3'))).toEqual([]);
  });
});
