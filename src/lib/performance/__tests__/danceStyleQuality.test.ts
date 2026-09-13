import { diatonicLibrary, diatonicSeventhLibrary, MAJOR_KEYS } from '@/data/music';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import type { VoicingPosition } from '@/lib/performance/baseVoicing';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { ChordDuration, ChordEvent } from '@/types';

function render(
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
  position: VoicingPosition = 'root',
  effect: 'sustain' | 'releaseCut' = 'sustain',
  variant: 'natural.dance1' | 'natural.type1' = 'natural.dance1',
) {
  return buildSessionPerformancePlan({
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: variant,
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    octaveShift: 0,
    voicingPosition: position,
    releaseCut: effect === 'releaseCut',
    instrumentEffect: effect,
    drumMode: 'off',
    progression: progression.chords,
  });
}

function baseSignature(plan: ReturnType<typeof render>): string {
  return plan.chords
    .map((chord) => `${chord.bassMidi.join(',')}/${chord.bodyMidi.join(',')}`)
    .join('|');
}

function auditionChord(
  displayName: string,
  rootOffset: number,
  suffix: string,
  durationBeats: ChordDuration,
  bassOffset?: number,
): ChordEvent {
  return {
    id: `dance-half-${displayName}`,
    chordId: `dance-half-${displayName}`,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
    definitionId: definitionIdForSuffix(suffix),
    bassOffset,
  };
}

const ATTACHED_HALF_BAR_PROGRESSION = {
  ...GOLDEN_PROGRESSIONS[0]!,
  name: 'Attached Dance half-bar audition',
  bpm: 110,
  chords: [
    auditionChord('C', 0, '', 4),
    auditionChord('Bdim', 11, 'dim', 2),
    auditionChord('E7', 4, '7', 2),
    auditionChord('Am7', 9, 'm7', 4),
    auditionChord('Gm7', 7, 'm7', 2),
    auditionChord('C7', 0, '7', 2),
    auditionChord('Fsus2', 5, 'sus2', 4),
    auditionChord('Em7', 4, 'm7', 2),
    auditionChord('Am7', 9, 'm7', 2),
    auditionChord('Dm7', 2, 'm7', 4),
    auditionChord('Dm/G', 2, 'm', 4, 7),
  ],
};

const ATTACHED_SPLIT_TERMINAL_PROGRESSION = {
  ...GOLDEN_PROGRESSIONS[0]!,
  name: 'Attached Dance split-terminal audition',
  bpm: 130,
  chords: [
    auditionChord('Fmaj7', 5, 'maj7', 4),
    auditionChord('G7', 7, '7', 4),
    auditionChord('Em7', 4, 'm7', 4),
    auditionChord('Am7', 9, 'm7', 4),
    auditionChord('Dm7', 2, 'm7', 4),
    auditionChord('E7', 4, '7', 4),
    auditionChord('Am7', 9, 'm7', 4),
    auditionChord('Gm7', 7, 'm7', 2),
    auditionChord('C7', 0, '7', 2),
  ],
};

describe('Variation Dance production quality', () => {
  it('plays the measured eight-bar phrase with dropout and terminal roll/fill', () => {
    const source = GOLDEN_PROGRESSIONS[0]!;
    const plan = render({ ...source, chords: [...source.chords, ...source.chords] });
    const expected = [
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.75, 2.5, 3.5],
      [0, 0.0438, 1, 1.75, 2.5, 3, 3.5],
    ];
    plan.chords.forEach((chord, chordIndex) => {
      const onsets = [
        ...new Set(
          plan.notes
            .filter(
              (note) =>
                note.trackId === 'chord' &&
                note.timeBeat >= chord.startBeat - 1e-9 &&
                note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
            )
            .map((note) => Number((note.timeBeat - chord.startBeat).toFixed(6))),
        ),
      ];
      expect(onsets).toEqual(expected[chordIndex]);
    });
  });

  it('keeps the attached C–Bdim–E7 half-bar audition on the physical eight-bar phrase', () => {
    const plan = render(ATTACHED_HALF_BAR_PROGRESSION);
    const expected = [
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75],
      [0, 0.5, 1.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75],
      [0, 0.5, 1.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75],
      [0, 0.5, 1.5],
      [0, 1, 1.75, 2.5, 3.5],
      [0, 0.0438, 1, 1.75, 2.5, 3, 3.5],
    ];

    plan.chords.forEach((chord, chordIndex) => {
      const notes = plan.notes.filter(
        (note) =>
          note.trackId === 'chord' &&
          note.timeBeat >= chord.startBeat - 1e-9 &&
          note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
      );
      const onsets = [
        ...new Set(notes.map((note) => Number((note.timeBeat - chord.startBeat).toFixed(4)))),
      ];
      expect(onsets).toEqual(expected[chordIndex]);

      const boundary = notes.filter((note) => Math.abs(note.timeBeat - chord.startBeat) <= 1e-9);
      expect(boundary.length).toBeGreaterThan(0);
      expect(Math.min(...boundary.map((note) => note.pitch))).toBe(chord.bassMidi[0]);

      if (chord.durationBeats === 2) {
        expect(Math.min(...notes.map((note) => note.durationBeat))).toBeGreaterThanOrEqual(0.5);
      }
    });

    for (const firstHalfIndex of [1, 4, 7]) {
      const firstHalf = plan.chords[firstHalfIndex]!;
      const next = plan.chords[firstHalfIndex + 1]!;
      const anticipation = plan.notes.filter(
        (note) =>
          note.trackId === 'chord' &&
          Math.abs(note.timeBeat - (firstHalf.startBeat + 1.75)) <= 1e-9,
      );
      expect(anticipation.length).toBeGreaterThan(0);
      expect(
        anticipation.every((note) => note.harmonyTargetChordIndex === firstHalfIndex + 1),
      ).toBe(true);
      expect(
        anticipation.every((note) => [...next.bassMidi, ...next.bodyMidi].includes(note.pitch)),
      ).toBe(true);
    }

    expect(plan.harmonyViolations).toEqual([]);
    expect(plan.collisionReport?.rejects).toEqual([]);
  });

  it('supports the attached Am7 dropout only when Gm7–C7 split the terminal bar', () => {
    const plan = render(ATTACHED_SPLIT_TERMINAL_PROGRESSION);
    const earlierAm7 = plan.chords[3]!;
    const dropoutAm7 = plan.chords[6]!;
    const notesIn = (chord: (typeof plan.chords)[number]) =>
      plan.notes.filter(
        (note) =>
          note.trackId === 'chord' &&
          note.timeBeat >= chord.startBeat - 1e-9 &&
          note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
      );

    expect(notesIn(earlierAm7)).toHaveLength(23);
    expect(notesIn(dropoutAm7)).toHaveLength(18);
    expect([
      ...new Set(
        notesIn(dropoutAm7).map((note) =>
          Number((note.timeBeat - dropoutAm7.startBeat).toFixed(4)),
        ),
      ),
    ]).toEqual([0, 1, 1.5, 1.75, 2.5, 3.5]);

    const support = notesIn(dropoutAm7).filter(
      (note) => Math.abs(note.timeBeat - (dropoutAm7.startBeat + 1.5)) <= 1e-9,
    );
    expect(support).toHaveLength(2);
    expect(support.map((note) => note.velocity)).toEqual([80, 80]);
    expect(plan.harmonyViolations).toEqual([]);
    expect(plan.collisionReport?.rejects).toEqual([]);
  });

  it('closes a sixteen-bar progression as fully as the phrase before it', () => {
    const source = GOLDEN_PROGRESSIONS[0]!;
    const chords = Array.from({ length: 16 }, (_, index) => ({
      ...source.chords[index % source.chords.length]!,
      id: `dance-sixteen-${index}`,
      durationBeats: 4 as ChordDuration,
    }));
    const plan = render({ ...source, chords });
    const notesIn = (chord: (typeof plan.chords)[number]) =>
      plan.notes.filter(
        (note) =>
          note.trackId === 'chord' &&
          note.timeBeat >= chord.startBeat - 1e-9 &&
          note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
      );
    const onsetsIn = (chord: (typeof plan.chords)[number]) => [
      ...new Set(notesIn(chord).map((note) => Number((note.timeBeat - chord.startBeat).toFixed(4)))),
    ];

    // The first phrase keeps its measured breath; the closing one is filled back in.
    expect(onsetsIn(plan.chords[6]!)).toEqual([0, 1, 1.75, 2.5, 3.5]);
    expect(onsetsIn(plan.chords[14]!)).toEqual([0, 1, 1.5, 1.75, 2.5, 3.5]);
    expect(notesIn(plan.chords[14]!)).toHaveLength(notesIn(plan.chords[13]!).length);

    const support = notesIn(plan.chords[14]!).filter(
      (note) => Math.abs(note.timeBeat - (plan.chords[14]!.startBeat + 1.5)) <= 1e-9,
    );
    expect(support).toHaveLength(2);
    expect(support.map((note) => note.velocity)).toEqual([80, 80]);
    expect(support.map((note) => note.pitch)).toEqual([
      plan.chords[14]!.bassMidi[0],
      Math.min(...plan.chords[14]!.bodyMidi),
    ]);

    // The terminal roll/fill bar is untouched.
    expect(onsetsIn(plan.chords[15]!)).toEqual([0, 0.0438, 1, 1.75, 2.5, 3, 3.5]);
    expect(plan.harmonyViolations).toEqual([]);
    expect(plan.collisionReport?.rejects).toEqual([]);
  });

  it('uses the same split-terminal rhythm for every Golden harmony in all twelve keys', () => {
    const expected = [
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 0.0438, 1, 1.75],
      [0, 0.5, 1, 1.5],
    ];

    for (const source of GOLDEN_PROGRESSIONS) {
      for (const key of MAJOR_KEYS) {
        const chords = Array.from({ length: 9 }, (_, index) => ({
          ...source.chords[index % source.chords.length]!,
          id: `dance-general-${source.id}-${key}-${index}`,
          durationBeats: (index < 7 ? 4 : 2) as ChordDuration,
        }));
        const plan = render({ ...source, key, bpm: 130, chords });
        const actual = plan.chords.map((chord) => [
          ...new Set(
            plan.notes
              .filter(
                (note) =>
                  note.trackId === 'chord' &&
                  note.timeBeat >= chord.startBeat - 1e-9 &&
                  note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
              )
              .map((note) => Number((note.timeBeat - chord.startBeat).toFixed(4))),
          ),
        ]);

        expect({ source: source.id, key, actual }).toEqual({
          source: source.id,
          key,
          actual: expected,
        });
        expect({ source: source.id, key, violations: plan.harmonyViolations }).toEqual({
          source: source.id,
          key,
          violations: [],
        });
      }
    }
  });

  it('keeps every diatonic split-terminal transition collision-clean in all twelve keys', () => {
    for (const key of MAJOR_KEYS) {
      const library = [...diatonicLibrary(key), ...diatonicSeventhLibrary(key)];
      for (let rotation = 0; rotation < library.length; rotation += 1) {
        const chords = Array.from({ length: 9 }, (_, index) => {
          const chord = library[(rotation + index) % library.length]!;
          return auditionChord(
            chord.displayName,
            chord.rootOffset,
            chord.suffix,
            index < 7 ? 4 : 2,
            chord.bassOffset,
          );
        });
        const plan = render({
          ...GOLDEN_PROGRESSIONS[0]!,
          key,
          bpm: 130,
          chords,
        });

        expect({
          key,
          rotation,
          violations: plan.harmonyViolations,
          rejects: plan.collisionReport?.rejects,
        }).toEqual({ key, rotation, violations: [], rejects: [] });
      }
    }
  });

  it('uses shaped block attacks and the measured Bass plus RH-bottom response', () => {
    const plan = render(GOLDEN_PROGRESSIONS[0]!);
    const chord = plan.chords[0]!;
    const at = (relativeBeat: number) =>
      plan.notes
        .filter(
          (note) =>
            note.trackId === 'chord' &&
            Math.abs(note.timeBeat - (chord.startBeat + relativeBeat)) <= 1e-9,
        )
        .sort((left, right) => left.pitch - right.pitch);

    const openingFull = at(0);
    const bass = openingFull.find((note) => chord.bassMidi.includes(note.pitch));
    const right = openingFull.filter((note) => !chord.bassMidi.includes(note.pitch));
    expect(bass?.velocity).toBe(85);
    expect(right.map((note) => note.velocity)).toEqual([87, 92, 102]);

    const response = at(1.5);
    expect(response).toHaveLength(2);
    expect(response.map((note) => note.velocity)).toEqual([84, 84]);
    expect(chord.bassMidi).toContain(response[0]!.pitch);
    expect(response[1]!.pitch).toBe(Math.min(...chord.bodyMidi));
  });

  it('uses only unchanged Shared Base pitches across Golden A–I and every inversion', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      for (const position of ['root', 'first', 'second'] as const) {
        const dance = render(progression, position);
        expect(baseSignature(dance)).toBe(
          baseSignature(render(progression, position, 'sustain', 'natural.type1')),
        );
        expect(dance.harmonyViolations).toEqual([]);
        for (const chord of dance.chords) {
          expect(chord.bassMidi.length).toBeGreaterThan(0);
          expect(chord.bodyMidi.length).toBeGreaterThan(0);
          expect(Math.max(...chord.bassMidi)).toBeLessThan(Math.min(...chord.bodyMidi));
          expect([...chord.bodyMidi].sort((a, b) => a - b)).toEqual(chord.bodyMidi);
        }
        const seen = new Set<string>();
        for (const note of dance.notes.filter((candidate) => candidate.trackId === 'chord')) {
          const chord = dance.chords.find(
            (candidate) =>
              note.timeBeat >= candidate.startBeat - 1e-9 &&
              note.timeBeat < candidate.startBeat + candidate.durationBeats - 1e-9,
          )!;
          expect([...chord.bassMidi, ...chord.bodyMidi]).toContain(note.pitch);
          expect(note.pitch).toBeGreaterThanOrEqual(0);
          expect(note.pitch).toBeLessThanOrEqual(127);
          const key = `${note.timeBeat.toFixed(6)}:${note.pitch}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it('remains legal in all twelve keys and preserves slash bass in full attacks', () => {
    const source = GOLDEN_PROGRESSIONS.find((progression) => progression.id === 'D')!;
    for (const key of MAJOR_KEYS) {
      const plan = render({ ...source, key });
      expect(plan.harmonyViolations).toEqual([]);
      for (const chord of plan.chords) {
        const fullAttack = plan.notes.filter(
          (note) => note.trackId === 'chord' && Math.abs(note.timeBeat - chord.startBeat) <= 1e-9,
        );
        expect(Math.min(...fullAttack.map((note) => note.pitch))).toBe(chord.bassMidi[0]);
      }
    }
  });

  it('keeps a full–half–half–full progression on one continuous Dance bar grid', () => {
    const source = GOLDEN_PROGRESSIONS[0]!;
    const durations: readonly ChordDuration[] = [4, 2, 2, 4];
    const plan = render({
      ...source,
      chords: source.chords.map((chord, index) => ({
        ...chord,
        durationBeats: durations[index]!,
      })),
    });
    const expected = [
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75],
      [0, 0.5, 1.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
    ];
    plan.chords.forEach((chord, index) => {
      const onsets = [
        ...new Set(
          plan.notes
            .filter(
              (note) =>
                note.trackId === 'chord' &&
                note.timeBeat >= chord.startBeat - 1e-9 &&
                note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
            )
            .map((note) => Number((note.timeBeat - chord.startBeat).toFixed(6))),
        ),
      ];
      expect(onsets).toEqual(expected[index]);
    });
  });

  it('uses measured note overlap without adding CC64', () => {
    const plan = render(GOLDEN_PROGRESSIONS[0]!);
    expect(buildFinalMidiSnapshot(plan).controlChanges).toEqual([]);
    expect(
      buildFinalMidiSnapshot(render(GOLDEN_PROGRESSIONS[0]!, 'root', 'releaseCut')).controlChanges,
    ).toEqual([]);
  });
});
