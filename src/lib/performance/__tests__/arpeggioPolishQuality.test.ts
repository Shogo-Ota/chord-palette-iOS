import { createHash } from 'node:crypto';

import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';

function render(effect: 'sustain' | 'releaseCut' = 'sustain') {
  const source = GOLDEN_PROGRESSIONS[0]!;
  return buildSessionPerformancePlan({
    key: source.key,
    tempoBpm: source.bpm,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: 'natural.type5',
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    octaveShift: 0,
    voicingPosition: 'root',
    releaseCut: effect === 'releaseCut',
    instrumentEffect: effect,
    drumMode: 'off',
    progression: source.chords,
  });
}

describe('Arpeggio apex and sustain quality', () => {
  it('freezes the Build 17 device-approved note and CC64 schedule', () => {
    const plan = render();
    const snapshot = buildFinalMidiSnapshot(plan);
    const payload = {
      notes: snapshot.notes
        .filter((note) => note.track === 'accompaniment')
        .map((note) => [
          note.startBeat,
          note.durationBeat,
          note.pitch,
          note.velocity,
          note.channel,
        ]),
      controlChanges: snapshot.controlChanges.map((event) => [
        event.startBeat,
        event.controller,
        event.value,
        event.channel,
      ]),
    };
    expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).toBe(
      '4ff013c87cb9bbb9d8011f47df2051c40864bfda1d2e9dc5123fa3a13a9f0834',
    );
  });

  it('plays one apex followed by a one-beat breathing space before descending', () => {
    const plan = render();
    for (const chord of plan.chords) {
      const notes = plan.notes
        .filter(
          (note) =>
            note.trackId === 'chord' &&
            note.timeBeat >= chord.startBeat - 1e-9 &&
            note.timeBeat < chord.startBeat + chord.durationBeats - 1e-9,
        )
        .sort((left, right) => left.timeBeat - right.timeBeat);
      expect(notes.map((note) => Number((note.timeBeat - chord.startBeat).toFixed(6)))).toEqual([
        0, 0.5, 1, 1.5, 2.5, 3, 3.5,
      ]);
      const apex = Math.max(...notes.map((note) => note.pitch));
      expect(notes.filter((note) => note.pitch === apex)).toHaveLength(1);
      expect(notes.some((note) => Math.abs(note.timeBeat - (chord.startBeat + 2)) <= 1e-9)).toBe(
        false,
      );
    }
  });

  it('holds controlled resonance until 3.9 and releases at every chord boundary', () => {
    const plan = render();
    const cc64 = buildFinalMidiSnapshot(plan).controlChanges;
    expect(cc64.slice(0, 2).map((event) => [event.startBeat, event.value])).toEqual([
      [0, 96],
      [3.9, 0],
    ]);
    for (const chord of plan.chords) {
      const boundary = chord.startBeat + chord.durationBeats;
      expect(
        cc64.some((event) => Math.abs(event.startBeat - boundary) <= 1e-9 && event.value === 0),
      ).toBe(true);
    }
    expect(buildFinalMidiSnapshot(render('releaseCut')).controlChanges).toEqual([]);
  });
});
