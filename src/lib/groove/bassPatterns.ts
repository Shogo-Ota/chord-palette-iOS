/**
 * Independent bass PatternDocs (Phase 6).
 * Compatible mode: locked quarter-notes on root/5th-capable MIDI (<48).
 * Velocities calibrated from GT-001 (GroundTruthMidi.md) — restrained dynamics.
 */

import type { CompStroke } from '@/lib/groove/types';

export type BassPatternId = 'locked-quarters';

export type BassPatternDoc = {
  id: BassPatternId;
  /** Strokes within one 4/4 bar (absolute beat 0..4). */
  strokes: CompStroke[];
  nominalRingBeats: number;
  timingAmountBeats: number;
  velAmount: number;
};

/** GT-001: downbeat median ~MIDI 75 → gain ≈ 0.59; keep mild accent. */
export const BASS_PATTERNS: Record<BassPatternId, BassPatternDoc> = {
  'locked-quarters': {
    id: 'locked-quarters',
    strokes: [
      { beat: 0, vel: 0.62 },
      { beat: 1, vel: 0.56 },
      { beat: 2, vel: 0.6 },
      { beat: 3, vel: 0.55 },
    ],
    nominalRingBeats: 0.5, // GT-001 bass median duration ≈ 0.5 beat
    timingAmountBeats: 0,
    velAmount: 0.03,
  },
};

export function getBassPattern(id: string | undefined): BassPatternDoc {
  if (id && id in BASS_PATTERNS) return BASS_PATTERNS[id as BassPatternId];
  return BASS_PATTERNS['locked-quarters'];
}
