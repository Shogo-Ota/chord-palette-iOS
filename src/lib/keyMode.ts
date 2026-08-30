import type { KeyMode } from '@/types';

/**
 * Key mode vocabulary and normalization (pure domain, UI/Expo independent).
 *
 * `major` is the default everywhere so every pre-minor project, preset and call site
 * keeps its current reading without being touched. Persisted values arrive as opaque
 * strings (SQLite column, `chord_events` JSON), so every read path funnels through
 * {@link normalizeKeyMode} rather than casting.
 */

/** Selector order: major first, because it is the default and the larger library. */
export const KEY_MODES: readonly KeyMode[] = ['major', 'minor'];

export const DEFAULT_KEY_MODE: KeyMode = 'major';

export function normalizeKeyMode(value: unknown): KeyMode {
  return KEY_MODES.includes(value as KeyMode) ? (value as KeyMode) : DEFAULT_KEY_MODE;
}

export function isMinorMode(value: unknown): boolean {
  return normalizeKeyMode(value) === 'minor';
}

/** Japanese label for the mode chip / key picker (e.g. "A マイナー"). */
export function keyModeLabel(mode: KeyMode): string {
  return mode === 'minor' ? 'マイナー' : 'メジャー';
}
