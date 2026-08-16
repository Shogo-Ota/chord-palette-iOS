/**
 * Drum subdivision for Full mode (Groove screen): 8-beat / 16-beat / triplet.
 * Clap mode ignores this — it is always backbeat claps (2 & 4).
 */

export type DrumBeat = '8' | '16' | '3';

export const DRUM_BEAT_IDS: readonly DrumBeat[] = ['8', '16', '3'];

/** Default Full kit: the 8th-note groove the app has always played. */
export const DEFAULT_DRUM_BEAT: DrumBeat = '8';

export const DRUM_BEAT_LABELS: Record<DrumBeat, string> = {
  '8': '8ビート',
  '16': '16ビート',
  '3': '3連符',
};

export function normalizeDrumBeat(raw: unknown): DrumBeat {
  if (raw === '8' || raw === '16' || raw === '3') return raw;
  // Stored `4` was the old quarter-note kit — fold into 8-beat.
  if (raw === '4') return '8';
  return DEFAULT_DRUM_BEAT;
}
