/**
 * Accompaniment-id migration (design §3 3-layer redesign). The UI moved from the
 * two "beat" ids to the three data-driven feels, so persisted projects (and any
 * external input) may still carry the retired ids. This single pure function is
 * the ONE place that maps any raw string onto the current `AccompanimentPattern`,
 * so the type itself never has to keep the legacy members alive:
 *
 *   - `eightBeat`     → `natural`   (the standard J-POP comp)
 *   - `sixteenthBeat` → `driving`   (busier, forward-motion 16-feel)
 *   - `block` / `arpeggio` / `natural` / `driving` / `relaxed` → unchanged
 *   - anything else   → `natural`   (safe, musical default)
 *
 * Pure and RN/Expo-independent (domain layer): used by the read paths in
 * `session.ts` and `projectRepository.ts`, and unit-tested in isolation.
 */

import type { AccompanimentPattern } from '@/types';

/** The current, valid accompaniment ids (the `AccompanimentPattern` union). */
const VALID: ReadonlySet<AccompanimentPattern> = new Set<AccompanimentPattern>([
  'block',
  'arpeggio',
  'natural',
  'driving',
  'relaxed',
]);

/** Retired ids → their closest current feel (data-driven, no switch). */
const LEGACY_MIGRATION: Readonly<Record<string, AccompanimentPattern>> = {
  eightBeat: 'natural',
  sixteenthBeat: 'driving',
};

/** The default used for new sessions and any unknown/legacy input. */
export const DEFAULT_ACCOMPANIMENT: AccompanimentPattern = 'natural';

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
