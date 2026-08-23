/** Product-owned chord audition length. A UI sound effect must not change with BPM. */
export const CHORD_PREVIEW_DURATION_SECONDS = 2;

export type ChordPreviewTiming = {
  durationSec: number;
  /** Compatibility value for native binaries that predate `durationSec`. */
  lengthBeats: number;
  bpm: number;
};

export function chordPreviewTiming(bpm: number): ChordPreviewTiming {
  const safeBpm = Number.isFinite(bpm) ? Math.max(1, bpm) : 120;
  return {
    durationSec: CHORD_PREVIEW_DURATION_SECONDS,
    lengthBeats: CHORD_PREVIEW_DURATION_SECONDS * (safeBpm / 60),
    bpm: safeBpm,
  };
}
