/** Device-level drum playback mode (Groove screen). */

export type DrumMode = 'off' | 'clap' | 'full';

export const DRUM_MODE_IDS: readonly DrumMode[] = ['off', 'clap', 'full'];

/** Default: backbeat claps on 2 & 4. */
export const DEFAULT_DRUM_MODE: DrumMode = 'clap';

export const DRUM_MODE_LABELS: Record<DrumMode, string> = {
  off: 'オフ',
  clap: 'クラップ',
  full: 'フル',
};

export function normalizeDrumMode(raw: unknown): DrumMode {
  if (raw === 'off' || raw === 'clap' || raw === 'full') return raw;
  // Stored `kick` was the old sparse mode — clap is the new one.
  if (raw === 'kick') return 'clap';
  return DEFAULT_DRUM_MODE;
}

/** Subdivision chips only apply to the full kit. */
export function drumBeatSelectorVisible(mode: DrumMode): boolean {
  return mode === 'full';
}
