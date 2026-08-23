import {
  CHORD_PREVIEW_DURATION_SECONDS,
  chordPreviewTiming,
} from '@/features/editor/chordPreviewPolicy';
import { chordPreviewRequest } from '@/features/editor/playback';

describe('chord preview timing policy', () => {
  it.each([60, 100, 180])('stays at two wall-clock seconds at %s BPM', (bpm) => {
    const timing = chordPreviewTiming(bpm);
    expect(timing.durationSec).toBe(2);
    expect(timing.lengthBeats * (60 / timing.bpm)).toBeCloseTo(2, 8);
  });

  it('writes both the canonical duration and old-native compatibility beats', () => {
    const request = chordPreviewRequest(
      { rootOffset: 0, suffix: '', definitionId: 'maj' },
      'C',
      150,
      'piano',
    );
    expect(request.durationSec).toBe(CHORD_PREVIEW_DURATION_SECONDS);
    expect(request.lengthBeats).toBe(5);
    expect(request.bpm).toBe(150);
  });

  it('normalizes invalid BPM without changing audition duration', () => {
    expect(chordPreviewTiming(Number.NaN)).toEqual({
      durationSec: 2,
      lengthBeats: 4,
      bpm: 120,
    });
  });
});
