/**
 * Feel layer entry point (design §3-1). A user-facing *feel* (Natural / Driving /
 * Relaxed) is resolved here into the three concrete engine inputs the Performance
 * Engine reasons about:
 *
 *   resolveFeel = resolveFeelTemplate  (groove skeleton + humanizeScale)
 *              +  VARIATION_BY_FEEL     (Musical Variation profile)
 *
 * This is the ONLY composition point — the template picker (`templates.ts`) and the
 * variation profiles (`profiles.ts`) stay independent and data-driven, so tuning a
 * feel is editing a table, not this code. Pure function of `(feelId, context)`:
 * same inputs ⇒ identical `ResolvedFeel`. No native / RN / Expo imports.
 */

import type { StylePreset } from '../styles/types';

import { VARIATION_BY_FEEL } from './profiles';
import { resolveFeelTemplate } from './templates';
import type { FeelContext, FeelId, ResolvedFeel } from './types';

export * from './types';

/** The three data-driven feels, in UI order (block/arpeggio bypass this layer). */
export const FEEL_IDS: readonly FeelId[] = ['natural', 'driving', 'relaxed'];

/** Type guard: is a raw accompaniment/style id one of the Feel ids? */
export function isFeelId(id: string): id is FeelId {
  return id === 'natural' || id === 'driving' || id === 'relaxed';
}

/**
 * Resolve a Feel to its concrete template, Musical Variation profile and humanize
 * scale for the given tempo/groove context (design §3-1).
 */
export function resolveFeel(
  feelId: FeelId,
  ctx: FeelContext,
  forcedBase?: StylePreset,
): ResolvedFeel {
  const { template, humanizeScale } = resolveFeelTemplate(feelId, ctx, forcedBase);
  return {
    template,
    variation: VARIATION_BY_FEEL[feelId],
    humanizeScale,
  };
}
