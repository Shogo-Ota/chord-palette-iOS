import type { FinalMidiSnapshot } from '@/lib/midiExport';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';

import { degreeForPc } from '../analyze';
import { validateCase } from '../validate';

function emptyPlan(): SessionPerformancePlan {
  return {
    notes: [],
    chords: [
      {
        startBeat: 0,
        durationBeats: 4,
        bassMidi: [36],
        bodyMidi: [60, 64, 67],
        harmony: { symbol: 'C', rootPc: 0, quality: 'maj', chordIntervals: [0, 4, 7] },
      },
    ],
    progression: [
      {
        id: 'c',
        chordId: 'c',
        displayName: 'C',
        degreeLabel: 'I',
        function: 'tonic',
        durationBeats: 4,
        isPro: false,
        rootOffset: 0,
        suffix: '',
      },
    ],
    bpm: 90,
    totalBeats: 4,
    beatsPerBar: 4,
    drumPatternId: 'pop8',
    instrumentId: 'piano',
    drumMode: 'off',
    instrumentEffect: 'off',
    seed: 1,
  };
}

function snapshot(notes: FinalMidiSnapshot['notes']): FinalMidiSnapshot {
  return {
    bpm: 90,
    beatsPerBar: 4,
    timeSignature: { numerator: 4, denominator: 4 },
    totalBeats: 4,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes,
    controlChanges: [],
    markers: [{ startBeat: 0, label: 'C' }],
  };
}

describe('MIDI QA validators', () => {
  it('classifies compound extension intervals by pitch class', () => {
    expect(degreeForPc(2, 0, [0, 4, 7, 14])).toBe('ninth');
  });

  it('flags mid-bar single-note events on Block (C|F|G|C style)', () => {
    const snap = snapshot([
      { startBeat: 0, durationBeat: 1, pitch: 60, velocity: 80, channel: 0, track: 'accompaniment' },
      { startBeat: 0, durationBeat: 1, pitch: 64, velocity: 80, channel: 0, track: 'accompaniment' },
      { startBeat: 0, durationBeat: 1, pitch: 67, velocity: 80, channel: 0, track: 'accompaniment' },
      { startBeat: 1.5, durationBeat: 0.2, pitch: 64, velocity: 70, channel: 0, track: 'accompaniment' },
    ]);
    const verdict = validateCase('block__x__A', 'block', 'block.type1', 'A', snap, emptyPlan());
    expect(verdict.pass).toBe(false);
    expect(verdict.analysis.failures.some((f) => f.code === 'mid_bar_note_on')).toBe(true);
    expect(verdict.analysis.failures.some((f) => f.code === 'attack_group_count')).toBe(true);
  });

  it('passes a single downbeat triad on Block', () => {
    const snap = snapshot([
      { startBeat: 0, durationBeat: 3.8, pitch: 48, velocity: 80, channel: 0, track: 'accompaniment' },
      { startBeat: 0, durationBeat: 3.8, pitch: 52, velocity: 80, channel: 0, track: 'accompaniment' },
      { startBeat: 0, durationBeat: 3.8, pitch: 55, velocity: 80, channel: 0, track: 'accompaniment' },
    ]);
    const verdict = validateCase('block__ok__A', 'block', 'block.type1', 'A', snap, emptyPlan());
    const rhythm = verdict.analysis.failures.filter((f) => f.category === 'rhythm');
    const harmony = verdict.analysis.failures.filter((f) => f.category === 'harmony');
    expect(rhythm).toEqual([]);
    expect(harmony).toEqual([]);
  });
});
