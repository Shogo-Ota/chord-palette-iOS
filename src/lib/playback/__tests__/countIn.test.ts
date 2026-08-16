import { countInForStart, EDITOR_COUNT_IN } from '@/lib/playback/countIn';

describe('editor count-in policy', () => {
  it('uses four quarter-note side-stick cues with a stronger final cue', () => {
    expect(EDITOR_COUNT_IN).toEqual({
      beats: 4,
      midiNote: 37,
      velocity: 82,
      finalVelocity: 104,
    });
    expect(EDITOR_COUNT_IN.finalVelocity).toBeGreaterThan(EDITOR_COUNT_IN.velocity);
  });

  it('is present only when transport starts from the song head', () => {
    expect(countInForStart(0)).toEqual(EDITOR_COUNT_IN);
    expect(countInForStart(2)).toBeUndefined();
  });

  it('returns an independent request value instead of exposing the frozen constant', () => {
    expect(countInForStart()).not.toBe(EDITOR_COUNT_IN);
  });
});
