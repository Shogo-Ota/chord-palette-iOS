import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import { composeCompareFinalMidi } from '@/lib/videoExport/comparison';

function midi(pitch: number): FinalMidiSnapshot {
  return {
    bpm: 100,
    beatsPerBar: 4,
    timeSignature: { numerator: 4, denominator: 4 },
    totalBeats: 16,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes: [
      {
        startBeat: 0,
        durationBeat: 1,
        pitch,
        velocity: 90,
        channel: 0,
        track: 'accompaniment',
      },
    ],
    controlChanges: [{ startBeat: 0, controller: 64, value: 127, channel: 0 }],
    markers: [{ startBeat: 0, label: 'C' }],
  };
}

describe('composeCompareFinalMidi', () => {
  it('copies A then offsets every B event without mutating either snapshot', () => {
    const base = midi(60);
    const variant = midi(61);
    const before = JSON.stringify({ base, variant });
    const result = composeCompareFinalMidi(base, variant);
    if (!result.ok) throw new Error(result.reason);

    expect(result.value.totalBeats).toBe(32);
    expect(result.value.notes.map((note) => [note.pitch, note.startBeat])).toEqual([
      [60, 0],
      [61, 16],
    ]);
    expect(result.value.controlChanges.map((event) => event.startBeat)).toEqual([0, 16]);
    expect(result.value.markers).toEqual([
      { startBeat: 0, label: 'A · C' },
      { startBeat: 16, label: 'B · C' },
    ]);
    expect(JSON.stringify({ base, variant })).toBe(before);
  });

  it.each([
    [{ bpm: 120 }, 'TEMPO_MISMATCH'],
    [{ beatsPerBar: 3 }, 'METER_MISMATCH'],
    [{ instrumentId: 'ePiano' as const }, 'INSTRUMENT_MISMATCH'],
    [{ totalBeats: 8 }, 'DURATION_MISMATCH'],
  ])('rejects incompatible B snapshot %j', (patch, reason) => {
    expect(composeCompareFinalMidi(midi(60), { ...midi(61), ...patch })).toEqual({
      ok: false,
      reason,
    });
  });
});
