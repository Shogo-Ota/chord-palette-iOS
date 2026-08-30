import { applyHarmonyGate, chordIndexForNote } from '@/lib/performance/harmonyGate';
import { validateHarmonyCollisions } from '@/lib/performance/harmonyCollision';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';

const chords: PerfChord[] = [
  {
    startBeat: 0,
    durationBeats: 2,
    bassMidi: [48],
    bodyMidi: [60, 64, 67],
    harmony: { symbol: 'C', rootPc: 0, quality: 'maj', chordIntervals: [0, 4, 7] },
  },
  {
    startBeat: 2,
    durationBeats: 2,
    bassMidi: [50],
    bodyMidi: [62, 66, 69],
    harmony: { symbol: 'D', rootPc: 2, quality: 'maj', chordIntervals: [0, 4, 7] },
  },
];

function anticipated(target?: number): NoteEvent {
  return {
    timeBeat: 1.75,
    durationBeat: 0.5,
    pitch: 66,
    velocity: 84,
    articulation: 'normal',
    rrIndex: 0,
    trackId: 'chord',
    seed: 1,
    ...(target == null ? {} : { harmonyTargetChordIndex: target }),
  };
}

describe('explicit anticipation harmony ownership', () => {
  it('binds a declared early attack to its target chord', () => {
    const note = anticipated(1);

    expect(chordIndexForNote(chords, note)).toBe(1);
    expect(applyHarmonyGate([note], chords).violations).toEqual([]);
    expect(validateHarmonyCollisions([note], chords).rejects).toEqual([]);
  });

  it('does not globally widen the timing tolerance for undeclared notes', () => {
    const note = anticipated();

    expect(chordIndexForNote(chords, note)).toBe(0);
    expect(applyHarmonyGate([note], chords).violations).toHaveLength(1);
  });

  it('ignores an invalid explicit target and falls back to timeline binding', () => {
    const note = anticipated(99);

    expect(chordIndexForNote(chords, note)).toBe(0);
    expect(applyHarmonyGate([note], chords).violations).toHaveLength(1);
  });
});
