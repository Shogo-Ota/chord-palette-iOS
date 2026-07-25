import { compilePianoBeatStrikes } from '@/lib/groove/compilePiano';
import type { BeatStrike, ChordTimelineEvent } from '@/lib/groove/types';
import type { AccompanimentPattern } from '@/types';

/** Build beat-level piano strikes for a playback/export request. */
export function buildChordStrikesPayload(input: {
  bpm: number;
  totalBeats: number;
  chordEvents: ChordTimelineEvent[];
  accompaniment: string;
}): BeatStrike[] {
  return compilePianoBeatStrikes({
    bpm: input.bpm,
    totalBeats: input.totalBeats,
    events: input.chordEvents,
    patternId: input.accompaniment as AccompanimentPattern,
  });
}
