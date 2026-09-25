import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { snapshotToMidiEvents } from '@/lib/playback/nativePlaybackPlan';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { canonicalMidiEventPriority } from '@/lib/midiExport/eventOrdering';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';
import {
  chordStyleKey,
  PUBLIC_CHORD_STYLES,
  renderMaskedStyles,
  renderOwnerChordIndex,
  type EffectiveChordStyle,
} from '@/lib/performance/style';
import type { ChordDuration, ChordEvent } from '@/types';

const BLOCK: EffectiveChordStyle = { pattern: 'block', variant: 'block.type1' };
const NATURAL1: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type1' };
const NATURAL2: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type2' };
const NATURAL5: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type5' };
const CITY: EffectiveChordStyle = { pattern: 'city', variant: 'city.type1' };
const SOURCE = GOLDEN_PROGRESSIONS.find((progression) => progression.id === 'A')!;
const EPSILON = 1e-9;

function progression(
  styles: readonly EffectiveChordStyle[],
  duration: ChordDuration,
): ChordEvent[] {
  const global = styles[0]!;
  return SOURCE.chords.map((chord, index) => {
    const style = styles[index % styles.length]!;
    return {
      ...chord,
      durationBeats: duration,
      ...(chordStyleKey(style) === chordStyleKey(global)
        ? {}
        : { accompanimentOverride: { ...style } }),
    };
  });
}

function input(
  styles: readonly EffectiveChordStyle[],
  duration: ChordDuration,
): PerformanceSessionInput {
  const global = styles[0]!;
  return {
    key: SOURCE.key,
    tempoBpm: SOURCE.bpm,
    grooveId: 'pop8',
    accompanimentPattern: global.pattern,
    accompanimentVariant: global.variant,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: progression(styles, duration),
  };
}

function plan(styles: readonly EffectiveChordStyle[], duration: ChordDuration) {
  return buildSessionPerformancePlan(input(styles, duration), 'free');
}

function ccValuesAt(source: ReturnType<typeof plan>, beat: number): number[] {
  return source.controlChanges
    .filter((event) => Math.abs(event.startBeat - beat) <= EPSILON)
    .map((event) => event.value);
}

function noteIdentity(note: NoteEvent): string {
  return [
    note.timeBeat.toFixed(6),
    note.pitch,
    note.velocity,
    note.trackId,
    note.rrIndex,
    note.ownerChordIndex,
    note.harmonyTargetChordIndex ?? '-',
  ].join(':');
}

describe('P3 internal ownership model', () => {
  it.each(PUBLIC_CHORD_STYLES)(
    '$pattern/$variant tags every public rendered note with a valid owner',
    (style) => {
      const rendered = plan([style, style, style, style], 2);
      for (const note of rendered.notes) {
        expect(note.ownerChordIndex).toBeGreaterThanOrEqual(0);
        expect(note.ownerChordIndex).toBeLessThan(rendered.chords.length);
        expect(renderOwnerChordIndex(rendered.chords, note)).toBe(note.ownerChordIndex);
      }
    },
  );

  it('does not leak ownership metadata into Final MIDI', () => {
    const snapshot = buildFinalMidiSnapshot(plan([BLOCK, NATURAL2, CITY, NATURAL5], 2));
    expect(
      snapshot.notes.some((note) => Object.prototype.hasOwnProperty.call(note, 'ownerChordIndex')),
    ).toBe(false);
    expect(
      snapshot.controlChanges.some((event) =>
        Object.prototype.hasOwnProperty.call(event, 'ownerChordIndex'),
      ),
    ).toBe(false);
  });
});

describe.each([1, 2, 4] as const)('CC64 ownership at %i-beat STYLE boundaries', (duration) => {
  it('releases pedal for pedal-on → pedal-off', () => {
    const rendered = plan([NATURAL2, BLOCK, BLOCK, BLOCK], duration);
    const boundary = rendered.chords[1]!.startBeat;

    expect(ccValuesAt(rendered, boundary)).toContain(0);
    expect(
      rendered.controlChanges.some(
        (event) => event.startBeat >= boundary - EPSILON && event.value >= 64,
      ),
    ).toBe(false);
  });

  it('starts pedal only on the pedal-off → pedal-on owner', () => {
    const rendered = plan([BLOCK, NATURAL2, NATURAL2, NATURAL2], duration);
    const boundary = rendered.chords[1]!.startBeat;

    expect(ccValuesAt(rendered, boundary)).toContain(96);
    expect(
      rendered.controlChanges.some(
        (event) => event.startBeat < boundary - EPSILON && event.value >= 64,
      ),
    ).toBe(false);
  });

  it('orders pedal Up before Down for pedal-on → pedal-on', () => {
    const rendered = plan([NATURAL2, NATURAL5, NATURAL5, NATURAL5], duration);
    const boundary = rendered.chords[1]!.startBeat;

    expect(ccValuesAt(rendered, boundary)).toEqual([0, 96]);
  });

  it('leaves no pedal Down at loop end', () => {
    for (const styles of [
      [BLOCK, CITY, NATURAL2, NATURAL5],
      [NATURAL2, BLOCK, CITY, BLOCK],
    ] as const) {
      const rendered = plan(styles, duration);
      const last = rendered.controlChanges.at(-1);
      if (last) {
        expect(last.startBeat).toBeLessThanOrEqual(rendered.totalBeats + EPSILON);
        expect(last.value).toBeLessThan(64);
      }
    }
  });
});

describe('Final MIDI boundary and loop contract', () => {
  it.each([1, 2, 4] as const)(
    '%i-beat mix has matched notes and canonical same-beat order',
    (duration) => {
      const rendered = plan([NATURAL2, NATURAL5, BLOCK, CITY], duration);
      const snapshot = buildFinalMidiSnapshot(rendered);
      const events = snapshotToMidiEvents(snapshot);
      const noteOns = events.filter((event) => event.kind === 'on');
      const noteOffs = events.filter((event) => event.kind === 'off');

      expect(noteOffs).toHaveLength(noteOns.length);
      expect(noteOffs.every((event) => event.beat <= snapshot.totalBeats + EPSILON)).toBe(true);

      for (let index = 1; index < events.length; index += 1) {
        const previous = events[index - 1]!;
        const current = events[index]!;
        if (Math.abs(previous.beat - current.beat) > EPSILON) continue;
        expect(
          canonicalMidiEventPriority(previous.kind, previous.a, previous.b),
        ).toBeLessThanOrEqual(canonicalMidiEventPriority(current.kind, current.a, current.b));
      }
    },
  );

  it('emits NoteOff → CC64 Up → CC64 Down → NoteOn at a re-pedal boundary', () => {
    const rendered = plan([NATURAL2, NATURAL5, NATURAL5, NATURAL5], 2);
    const boundary = rendered.chords[1]!.startBeat;
    const messages = snapshotToMidiEvents(buildFinalMidiSnapshot(rendered))
      .filter((event) => Math.abs(event.beat - boundary) <= EPSILON)
      .map((event) => ({
        kind: event.kind,
        value: event.kind === 'cc' ? event.b : event.a,
      }));

    const firstOff = messages.findIndex(({ kind }) => kind === 'off');
    const pedalUp = messages.findIndex(({ kind, value }) => kind === 'cc' && value < 64);
    const pedalDown = messages.findIndex(({ kind, value }) => kind === 'cc' && value >= 64);
    const firstOn = messages.findIndex(({ kind }) => kind === 'on');

    expect(firstOff).toBeGreaterThanOrEqual(0);
    expect(pedalUp).toBeGreaterThan(firstOff);
    expect(pedalDown).toBeGreaterThan(pedalUp);
    expect(firstOn).toBeGreaterThan(pedalDown);
  });

  it('removes every mixed-STYLE CC64 when releaseCut is selected', () => {
    const request = input([NATURAL2, BLOCK, NATURAL5, CITY], 2);
    const rendered = buildSessionPerformancePlan(
      {
        ...request,
        releaseCut: true,
        instrumentEffect: 'releaseCut',
      },
      'free',
    );

    expect(rendered.controlChanges).toEqual([]);
    expect(buildFinalMidiSnapshot(rendered).controlChanges).toEqual([]);
  });
});

describe('explicit pedal closure fallback', () => {
  const chords: PerfChord[] = [
    {
      startBeat: 0,
      durationBeats: 2,
      bassMidi: [48],
      bodyMidi: [60, 64, 67],
    },
    {
      startBeat: 2,
      durationBeats: 2,
      bassMidi: [45],
      bodyMidi: [57, 60, 64],
    },
  ];

  it('inserts CC64 Up when a previous STYLE supplied Down without a release', () => {
    const rendered = renderMaskedStyles([NATURAL2, BLOCK], NATURAL2, chords, (style) => ({
      notes: [],
      controlChanges:
        chordStyleKey(style) === chordStyleKey(NATURAL2)
          ? [
              {
                startBeat: 0,
                controller: 64,
                value: 96,
                channel: 0,
                ownerChordIndex: 0,
              },
            ]
          : [],
    }));

    expect(rendered.controlChanges).toEqual([
      { startBeat: 0, controller: 64, value: 96, channel: 0 },
      { startBeat: 2, controller: 64, value: 0, channel: 0 },
    ]);
  });

  it('inserts CC64 Up at loop end for a mixed render whose last STYLE stays Down', () => {
    const rendered = renderMaskedStyles([BLOCK, NATURAL2], BLOCK, chords, (style) => ({
      notes: [],
      controlChanges:
        chordStyleKey(style) === chordStyleKey(NATURAL2)
          ? [
              {
                startBeat: 2,
                controller: 64,
                value: 96,
                channel: 0,
                ownerChordIndex: 1,
              },
            ]
          : [],
    }));

    expect(rendered.controlChanges).toEqual([
      { startBeat: 2, controller: 64, value: 96, channel: 0 },
      { startBeat: 4, controller: 64, value: 0, channel: 0 },
    ]);
  });
});

describe('phrase and bass boundary contracts', () => {
  it('keeps global phrase/RNG identity across the bar-4 phrase boundary', () => {
    const eightChords = [...SOURCE.chords, ...SOURCE.chords].map((chord, index) => ({
      ...chord,
      id: `${chord.id}-${index}`,
    }));
    const styles = [
      NATURAL1,
      NATURAL1,
      NATURAL1,
      CITY,
      NATURAL2,
      NATURAL2,
      NATURAL2,
      NATURAL2,
    ] as const;
    const mixedInput = {
      ...input(styles, 4),
      progression: eightChords.map((chord, index) => ({
        ...chord,
        accompanimentOverride: { ...styles[index]! },
      })),
    };
    const mixed = buildSessionPerformancePlan(mixedInput, 'free');

    styles.forEach((style, chordIndex) => {
      const reference = buildSessionPerformancePlan(
        {
          ...mixedInput,
          progression: eightChords.map((chord) => ({
            ...chord,
            accompanimentOverride: { ...style },
          })),
        },
        'free',
      );
      const expected = reference.notes
        .filter((note) => note.ownerChordIndex === chordIndex)
        .map(noteIdentity)
        .sort();
      const actual = mixed.notes
        .filter((note) => note.ownerChordIndex === chordIndex)
        .map(noteIdentity)
        .sort();
      expect(actual).toEqual(expected);
    });
  });

  it('drops a synthetic bass approach across STYLEs and preserves it inside one STYLE', () => {
    const chords: PerfChord[] = [
      {
        startBeat: 0,
        durationBeats: 1,
        bassMidi: [48],
        bodyMidi: [60, 64, 67],
      },
      {
        startBeat: 1,
        durationBeats: 1,
        bassMidi: [45],
        bodyMidi: [57, 60, 64],
      },
    ];
    const approach: NoteEvent = {
      timeBeat: 0.75,
      durationBeat: 0.25,
      pitch: 44,
      velocity: 80,
      articulation: 'staccato',
      rrIndex: 0,
      trackId: 'bass',
      ownerChordIndex: 0,
      harmonyTargetChordIndex: 1,
      seed: 1,
    };
    const render = (style: EffectiveChordStyle) => ({
      notes: chordStyleKey(style) === chordStyleKey(BLOCK) ? [approach] : [],
      controlChanges: [],
    });

    expect(renderMaskedStyles([BLOCK, CITY], BLOCK, chords, render).notes).toEqual([]);
    expect(renderMaskedStyles([BLOCK, BLOCK], BLOCK, chords, render).notes).toEqual([approach]);
  });
});
