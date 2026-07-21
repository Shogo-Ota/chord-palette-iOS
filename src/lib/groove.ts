/**
 * Groove-id migration. Mirrors {@link normalizeAccompaniment}: the ONE pure place
 * that maps any raw persisted/external string onto the current {@link GrooveId}, so
 * removing a groove never leaves an orphaned value in a saved project.
 *
 *   - `jazzSwing` (retired) → `pop8`  (Swing was dropped; fall back to the default 8-beat)
 *   - every current id passes through unchanged
 *   - anything else → `pop8`          (safe, matches the native drum fallback)
 *
 * Pure and RN/Expo-independent (domain layer): used by the DB read path in
 * `projectRepository.rowToProject`, and unit-tested in isolation.
 */

import type { GrooveId } from '@/types';

/** The current, valid groove ids (the `GrooveId` union). */
const VALID: ReadonlySet<GrooveId> = new Set<GrooveId>([
  'pop8',
  'pop16',
  'rock8',
  'rock16',
  'soul16',
  'bossaNova',
]);

/** Retired ids → their closest current groove (data-driven, no switch). */
const LEGACY_MIGRATION: Readonly<Record<string, GrooveId>> = {
  jazzSwing: 'pop8',
};

/** The default used for new sessions and any unknown/legacy input. */
export const DEFAULT_GROOVE: GrooveId = 'pop8';

/**
 * Normalize any raw groove id to a current {@link GrooveId}. Migrates legacy ids,
 * passes valid ids through, and falls back to the default for unknown input.
 * Deterministic and side-effect free.
 */
export function normalizeGroove(raw: unknown): GrooveId {
  if (typeof raw !== 'string') return DEFAULT_GROOVE;
  if (VALID.has(raw as GrooveId)) return raw as GrooveId;
  return LEGACY_MIGRATION[raw] ?? DEFAULT_GROOVE;
}
