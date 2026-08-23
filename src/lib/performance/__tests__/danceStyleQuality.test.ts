import { MAJOR_KEYS } from '@/data/music';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import type { VoicingPosition } from '@/lib/performance/baseVoicing';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordDuration } from '@/types';

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

  it('uses uncompressed prefixes for 1/2/full-bar chords', () => {
    const source = GOLDEN_PROGRESSIONS[0]!;
    const durations: readonly ChordDuration[] = [1, 2, 4, 1];
    const plan = render({
      ...source,
      chords: source.chords.map((chord, index) => ({
        ...chord,
        durationBeats: durations[index]!,
      })),
    });
    const expected = [[0], [0, 1, 1.5, 1.75], [0, 1, 1.5, 1.75, 2.5, 3.5], [0]];
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
