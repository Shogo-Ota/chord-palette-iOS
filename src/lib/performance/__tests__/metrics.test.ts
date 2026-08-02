/**
 * Unit tests for the Phase 9 quality metrics — hand-built events with known
 * answers, so the report's numbers can be trusted before anything reads them.
 */

import {
  computeMetrics,
  maxPolyphony,
  nonChordToneCount,
} from '@/lib/performance/analysis/metrics';
import type { NoteEvent, TrackId } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';

function note(over: Partial<NoteEvent> & { timeBeat: number; pitch: number }): NoteEvent {
  return {
    durationBeat: 1,
    velocity: 80,
    articulation: 'normal',
    rrIndex: 0,
    trackId: 'chord' as TrackId,
    seed: 1,
    ...over,
  };
}

/** One bar of C major (C E G body, C2 bass). */
const C_MAJOR: PerfChord[] = [
  { bodyMidi: [60, 64, 67], bassMidi: [36], arpMidi: [60, 64, 67], startBeat: 0, durationBeats: 4 },
];

describe('maxPolyphony', () => {
  it('counts simultaneous notes at the densest instant', () => {
    const notes = [
      note({ timeBeat: 0, pitch: 60, durationBeat: 2 }),
      note({ timeBeat: 0.5, pitch: 64, durationBeat: 2 }),
      note({ timeBeat: 1, pitch: 67, durationBeat: 2 }),
      note({ timeBeat: 4, pitch: 60, durationBeat: 1 }),
    ];
    expect(maxPolyphony(notes)).toBe(3);
  });

  it('does not double-count an exact re-strike boundary', () => {
    const notes = [
      note({ timeBeat: 0, pitch: 60, durationBeat: 1 }),
      note({ timeBeat: 1, pitch: 60, durationBeat: 1 }),
    ];
    expect(maxPolyphony(notes)).toBe(1);
  });
});

describe('nonChordToneCount', () => {
  it('flags a pitched note outside the chord and ignores drums', () => {
    const notes = [
      note({ timeBeat: 0, pitch: 60 }), // C — chord tone
      note({ timeBeat: 1, pitch: 62 }), // D — outside C major triad
      note({ timeBeat: 1, pitch: 38, trackId: 'snare' }), // drums never count
    ];
    expect(nonChordToneCount(notes, C_MAJOR)).toBe(1);
  });
});

describe('computeMetrics', () => {
  it('reports per-track stats with known answers', () => {
    const notes = [
      note({ timeBeat: 0, pitch: 60, velocity: 70 }),
      note({ timeBeat: 1.05, pitch: 64, velocity: 90 }), // 0.05 off the grid
      note({ timeBeat: 0, pitch: 36, velocity: 100, trackId: 'bass' }),
    ];
    const m = computeMetrics(notes, C_MAJOR);
    expect(m.totalNotes).toBe(3);
    expect(m.invalidNoteCount).toBe(0);
    const chord = m.perTrack.chord!;
    expect(chord.noteCount).toBe(2);
    expect(chord.velocityMean).toBe(80);
    expect(chord.velocityStdDev).toBe(10);
    expect(chord.pitchMin).toBe(60);
    expect(chord.pitchMax).toBe(64);
    expect(chord.timingDeviationMax).toBeCloseTo(0.05, 10);
    expect(m.perTrack.bass!.noteCount).toBe(1);
  });

  it('counts invariant violations instead of throwing', () => {
    const bad = [
      note({ timeBeat: -1, pitch: 60 }),
      note({ timeBeat: 0, pitch: 60, durationBeat: 0 }),
      note({ timeBeat: 0, pitch: 60, velocity: 200 }),
    ];
    expect(computeMetrics(bad, C_MAJOR).invalidNoteCount).toBe(3);
  });
});
