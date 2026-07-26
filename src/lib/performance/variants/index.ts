/**
 * Accompaniment variants — public API.
 *
 * Two jobs: tell the screen which variants an accompaniment offers, and tell the
 * engine what a chosen one means. Everything is a pure function of the catalog, so
 * a new variant needs no change here.
 *
 * Unknown or stale ids resolve to the accompaniment's default rather than throwing —
 * a project saved by a newer build, or one whose variant was retired, must still
 * play. This mirrors `normalizeAccompaniment`: the read path is the one place that
 * decides what a raw string means.
 */

import { isAccompanimentPattern } from '@/lib/accompaniment';
import type { AccompanimentPattern } from '@/types';

import { VARIANT_CATALOG } from './catalog';
import type { AccompanimentVariant, AccompanimentVariantId } from './types';

export type { AccompanimentVariant, AccompanimentVariantId } from './types';
export { VARIANT_CATALOG } from './catalog';

/** The variants an accompaniment offers, in chip order. */
export function variantsFor(pattern: AccompanimentPattern): readonly AccompanimentVariant[] {
  return VARIANT_CATALOG[pattern];
}

/** The variant an accompaniment falls back to — the reading it had before variants. */
export function defaultVariantFor(pattern: AccompanimentPattern): AccompanimentVariant {
  return VARIANT_CATALOG[pattern][0];
}

/**
 * Resolve a raw id against an accompaniment. An id belonging to a different
 * accompaniment counts as unknown, so switching accompaniment can never carry a
 * variant somewhere it does not apply.
 */
export function resolveVariant(
  pattern: AccompanimentPattern,
  id: unknown,
): AccompanimentVariant {
  if (typeof id === 'string') {
    const found = VARIANT_CATALOG[pattern].find((v) => v.id === id);
    if (found) return found;
  }
  return defaultVariantFor(pattern);
}

/** The id to persist for a raw value — always one this accompaniment actually offers. */
export function normalizeVariant(
  pattern: AccompanimentPattern,
  id: unknown,
): AccompanimentVariantId {
  return resolveVariant(pattern, id).id;
}

/** Whether a raw id is a variant of this accompaniment (no fallback). */
export function isVariantOf(pattern: AccompanimentPattern, id: unknown): boolean {
  return typeof id === 'string' && VARIANT_CATALOG[pattern].some((v) => v.id === id);
}

/**
 * Whether a raw `(accompaniment, variant)` pair means "the reading this accompaniment
 * had before variants existed". Takes a loose pattern because the callers that ask are
 * boundary code holding strings; anything that is not one of the five counts as
 * default, since it offers no variants to differ from.
 */
export function isDefaultVariant(pattern: string, id: unknown): boolean {
  if (!isAccompanimentPattern(pattern)) return true;
  return resolveVariant(pattern, id).id === defaultVariantFor(pattern).id;
}
