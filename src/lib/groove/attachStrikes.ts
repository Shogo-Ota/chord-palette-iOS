import { compilePianoBeatStrikes } from '@/lib/groove/compilePiano';
import { getDrumPattern } from '@/lib/groove/drumPatterns';
import type { BeatStrike, ChordTimelineEvent, DrumHitPayload } from '@/lib/groove/types';
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

/**
 * Build beat-level drum hits for a playback/export request from the groove id.
 * One 4/4 bar of hits (Native loops them); `tags` are dropped — Native only needs
 * beat/voice/vel to synthesize the one-shot. Mirrors the piano strikes bridge.
 */
export function buildDrumHitsPayload(input: { grooveId: string }): DrumHitPayload[] {
  return getDrumPattern(input.grooveId).hits.map((h) => ({
    beat: h.beat,
    voice: h.voice,
    vel: h.vel,
  }));
}
