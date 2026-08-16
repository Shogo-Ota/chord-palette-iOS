/**
 * Accompaniment-id migration (design §3 3-layer redesign). The UI moved from the
 * two "beat" ids to the three data-driven feels, so persisted projects (and any
 * external input) may still carry the retired ids. This single pure function is
 * the ONE place that maps any raw string onto the current `AccompanimentPattern`,
 * so the type itself never has to keep the legacy members alive:
 *
 *   - `eightBeat`     → `natural`   (the standard J-POP comp)
 *   - `sixteenthBeat` → `driving`   (busier, forward-motion 16-feel)
 *   - any id in the rhythm catalog → unchanged
 *   - anything else   → {@link DEFAULT_ACCOMPANIMENT} (offered by the Style screen)
 *
 * The retired "beat" ids keep pointing at the feels they were migrated to when the
 * UI first dropped them, NOT at the named rhythms added later: a project saved under
 * the old `eightBeat` was heard as Natural for two releases, and that is the sound
 * its owner knows.
 *
 * Pure and RN/Expo-independent (domain layer): used by the read paths in
 * `session.ts` and `projectRepository.ts`, and unit-tested in isolation.
 */

import { RHYTHM_IDS } from '@/lib/performance/rhythms';
import type { AccompanimentPattern } from '@/types';

/**
 * The current, valid accompaniment ids. Taken from the rhythm catalog rather than
 * restated, so a rhythm cannot be offered in the selector but rejected on read.
 */
const VALID: ReadonlySet<AccompanimentPattern> = new Set<AccompanimentPattern>(RHYTHM_IDS);

/** Retired ids → their closest current feel (data-driven, no switch). */
const LEGACY_MIGRATION: Readonly<Record<string, AccompanimentPattern>> = {
  eightBeat: 'natural',
  sixteenthBeat: 'driving',
};

/**
 * The default used for new sessions and any unknown/legacy input.
 *
 * It has to be one of the three the Style screen offers (`CORE_PATTERNS`), or a
 * brand-new session opens that screen with no pattern selected at all.
 */
export const DEFAULT_ACCOMPANIMENT: AccompanimentPattern = 'block';

/**
 * Normalize any raw accompaniment id to a current {@link AccompanimentPattern}.
 * Migrates legacy ids, passes valid ids through, and falls back to the musical
 * default for unknown input. Deterministic and side-effect free.
 */
/** Type guard: is a raw id one of the five current accompaniments (no migration)? */
export function isAccompanimentPattern(raw: unknown): raw is AccompanimentPattern {
  return typeof raw === 'string' && VALID.has(raw as AccompanimentPattern);
}

export function normalizeAccompaniment(raw: unknown): AccompanimentPattern {
  if (typeof raw !== 'string') return DEFAULT_ACCOMPANIMENT;
  if (VALID.has(raw as AccompanimentPattern)) return raw as AccompanimentPattern;
  return LEGACY_MIGRATION[raw] ?? DEFAULT_ACCOMPANIMENT;
}
