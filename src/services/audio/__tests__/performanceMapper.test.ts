import type { NoteEvent as PerfNote } from '@/lib/performance/NoteEvent';
import {
  mapPerfNotesToPlaybackRequest,
  performanceSeedFromSession,
  type PlaybackSessionSnapshot,
} from '@/services/audio/performanceMapper';

function note(partial: Partial<PerfNote> & Pick<PerfNote, 'pitch' | 'trackId'>): PerfNote {
  return {
    timeBeat: 0,
    durationBeat: 0.5,
    velocity: 90,
    articulation: 'normal',
    rrIndex: 0,
    seed: 1,
    ...partial,
  };
}

const baseSession: PlaybackSessionSnapshot = {
  key: 'C',
  tempoBpm: 100,
  grooveId: 'pop8',
  accompanimentPattern: 'eightBeat',
  instrumentId: 'piano',
  progression: [
    {
      id: 'a',
      chordId: 'a',
      displayName: 'C',
      degreeLabel: 'I',
      function: 'tonic',
      rootOffset: 0,
      suffix: '',
      durationBeats: 4,
      isPro: false,
    },
  ],
};

describe('performanceSeedFromSession', () => {
  it('is deterministic for the same session', () => {
    expect(performanceSeedFromSession(baseSession)).toBe(performanceSeedFromSession(baseSession));
  });

  it('changes when musical content changes', () => {
    const a = performanceSeedFromSession(baseSession);
    const b = performanceSeedFromSession({ ...baseSession, tempoBpm: 120 });
    expect(a).not.toBe(b);
  });
});

describe('mapPerfNotesToPlaybackRequest', () => {
  it('maps only chord/bass tracks and forces accompaniment=performance', () => {
    const notes: PerfNote[] = [
      note({ pitch: 36, trackId: 'bass', timeBeat: 0, velocity: 100 }),
      note({ pitch: 48, trackId: 'chord', timeBeat: 0, velocity: 96 }),
      note({ pitch: 36, trackId: 'kick', timeBeat: 0, velocity: 110 }),
      note({ pitch: 38, trackId: 'snare', timeBeat: 1, velocity: 100 }),
      note({ pitch: 42, trackId: 'hat', timeBeat: 0.5, velocity: 70 }),
    ];

    const req = mapPerfNotesToPlaybackRequest(notes, {
      bpm: 100,
      totalBeats: 16,
      loop: true,
      drumPatternId: 'pop8',
      instrument: 'piano',
    });

    expect(req.accompaniment).toBe('performance');
    expect(req.drumPatternId).toBe('pop8');
    expect(req.chordEvents).toHaveLength(2);
    expect(req.chordEvents.every((e) => e.midiNotes.length === 1)).toBe(true);
    expect(req.chordEvents.map((e) => e.midiNotes[0]).sort((a, b) => a - b)).toEqual([36, 48]);
    expect(req.chordEvents[0].velocity).toBe(100);
  });

  it('preserves microtiming/gate fields without re-quantizing away small offsets', () => {
    const notes: PerfNote[] = [
      note({ pitch: 60, trackId: 'chord', timeBeat: 0.9993, durationBeat: 0.72, velocity: 75 }),
    ];
    const req = mapPerfNotesToPlaybackRequest(notes, {
      bpm: 100,
      totalBeats: 4,
      loop: false,
      drumPatternId: 'pop8',
      instrument: 'piano',
    });
    expect(req.chordEvents[0].startBeat).toBeCloseTo(0.9993, 4);
    expect(req.chordEvents[0].lengthBeats).toBeCloseTo(0.72, 4);
  });
});
