import { sessionToPlaybackRequest } from '@/features/editor/playback';
import type { EditorSession } from '@/features/editor/session';
import type { ChordEvent } from '@/types';

function ev(partial: Partial<ChordEvent> & Pick<ChordEvent, 'rootOffset' | 'suffix'>): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'C',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    ...partial,
  };
}

describe('sessionToPlaybackRequest — groove bridge', () => {
  it('attaches non-empty beat-level chordStrikes for eightBeat', () => {
    const session = {
      tempoBpm: 120,
      key: 'C',
      grooveId: 'pop8',
      accompanimentPattern: 'eightBeat',
      instrumentId: 'piano',
      progression: [
        ev({ rootOffset: 0, suffix: '', durationBeats: 4 }),
        ev({ rootOffset: 7, suffix: '7', durationBeats: 4 }),
      ],
    } as EditorSession;

    const req = sessionToPlaybackRequest(session, true);
    expect(req.chordStrikes?.length).toBeGreaterThan(10);
    expect(req.chordStrikes![0]).toEqual(
      expect.objectContaining({
        startBeat: expect.any(Number),
        durationBeats: expect.any(Number),
        note: expect.any(Number),
        gain: expect.any(Number),
      }),
    );
    // Beat-level: no frame fields on the wire
    expect(req.chordStrikes![0]).not.toHaveProperty('startFrame');
  });

  it('attaches beat-level drumHits resolved from the groove id', () => {
    const session = {
      tempoBpm: 120,
      key: 'C',
      grooveId: 'rock8',
      accompanimentPattern: 'eightBeat',
      instrumentId: 'piano',
      progression: [ev({ rootOffset: 0, suffix: '', durationBeats: 4 })],
    } as EditorSession;

    const req = sessionToPlaybackRequest(session, true);
    expect(req.drumHits?.length).toBeGreaterThan(0);
    expect(req.drumHits![0]).toEqual(
      expect.objectContaining({
        beat: expect.any(Number),
        voice: expect.any(String),
        vel: expect.any(Number),
      }),
    );
    // rock8: kick on beats 1 & 3 (0-indexed 0 & 2).
    expect(req.drumHits!.filter((h) => h.voice === 'kick').map((h) => h.beat)).toEqual([0, 2]);
  });

  it('block strikes start at chord boundaries (beat 0 and 4)', () => {
    const session = {
      tempoBpm: 120,
      key: 'C',
      grooveId: 'pop8',
      accompanimentPattern: 'block',
      instrumentId: 'piano',
      progression: [
        ev({ rootOffset: 0, suffix: '', durationBeats: 4 }),
        ev({ rootOffset: 7, suffix: '', durationBeats: 4 }),
      ],
    } as EditorSession;

    const req = sessionToPlaybackRequest(session, true);
    const starts = [...new Set((req.chordStrikes ?? []).map((s) => Math.round(s.startBeat * 1000) / 1000))];
    expect(starts).toContain(0);
    expect(starts).toContain(4);
  });
});
