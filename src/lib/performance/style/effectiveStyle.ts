/**
 * Per-chord accompaniment STYLE resolution.
 *
 * A project owns one global STYLE; a chord may override it for itself alone:
 * `effectiveStyle(i) = progression[i].accompanimentOverride ?? global`. The resolved
 * list is derived on every read, never stored, so changing the project style moves
 * every non-overridden chord with it without any synchronisation step.
 *
 * An override is restricted to the release-public `(pattern, variant)` pairs. The
 * catalog deliberately keeps historical and internal readings so saved projects
 * still resolve, but an override must never name one: `arpeggio.*` is catalogued
 * and unoffered, and the UI label "Arpeggio Type 1" is `natural` / `natural.type5`.
 *
 * The global style is NOT narrowed here. Tests and legacy sessions legitimately
 * render non-public patterns, and narrowing them is the editor session's job.
 */

import { beatsPerBarFor } from '../rhythms';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '../publicAccompaniment';
import { offeredVariantsFor } from '../variants';
import type { AccompanimentVariantId } from '../variants';
import type { AccompanimentPattern, ChordEvent } from '@/types';

/** A fully resolved accompaniment selection for one chord. */
export type EffectiveChordStyle = {
  pattern: AccompanimentPattern;
  variant: AccompanimentVariantId;
};

/**
 * The `(pattern, variant)` pairs an override may name, derived from the release
 * availability policy so narrowing or widening a release needs no change here.
 */
export const PUBLIC_CHORD_STYLES: readonly EffectiveChordStyle[] =
  PUBLIC_ACCOMPANIMENT_PATTERNS.flatMap((pattern) =>
    offeredVariantsFor(pattern).map((variant) => ({ pattern, variant: variant.id })),
  );

/** Identity of a style for grouping. Two chords share a render pass iff these match. */
export function chordStyleKey(style: EffectiveChordStyle): string {
  return `${style.pattern}/${style.variant}`;
}

const PUBLIC_KEYS: ReadonlySet<string> = new Set(PUBLIC_CHORD_STYLES.map(chordStyleKey));

/**
 * Resolve a raw override against the public set and the project's meter.
 *
 * Returns `undefined` for anything unusable so the caller inherits the global
 * style — an override must degrade to "plays like the rest of the project" rather
 * than silently changing the music.
 *
 * The meter check is load-bearing: this design keeps one `beatsPerBar` for the
 * whole progression, which holds only because every public STYLE is in 4. A future
 * release that offers `waltz` (3) or `sixEight` (6) would break that assumption,
 * so a mismatched candidate is rejected here rather than remetered per chord.
 */
export function normalizeChordStyleOverride(
  raw: unknown,
  global: EffectiveChordStyle,
): EffectiveChordStyle | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const { pattern, variant } = raw as { pattern?: unknown; variant?: unknown };
  if (typeof pattern !== 'string' || typeof variant !== 'string') return undefined;
  const candidate: EffectiveChordStyle = { pattern: pattern as AccompanimentPattern, variant };
  if (!PUBLIC_KEYS.has(chordStyleKey(candidate))) return undefined;
  if (beatsPerBarFor(candidate.pattern) !== beatsPerBarFor(global.pattern)) return undefined;
  return candidate;
}

export type InvalidChordStyleOverrideHandler = (event: ChordEvent, rawOverride: unknown) => void;

/**
 * Normalize persisted chord overrides at a data boundary.
 *
 * Missing fields remain missing for backward compatibility. Invalid or non-public
 * pairs are removed, which is the persisted representation of "inherit Global".
 * The optional callback lets repositories report malformed saved data without
 * coupling this pure domain module to logging or monitoring infrastructure.
 */
export function normalizeChordStyleOverrides(
  progression: readonly ChordEvent[],
  global: EffectiveChordStyle,
  onInvalid?: InvalidChordStyleOverrideHandler,
): ChordEvent[] {
  return progression.map((event) => {
    if (!Object.prototype.hasOwnProperty.call(event, 'accompanimentOverride')) return event;
    const rawOverride = (event as ChordEvent & { accompanimentOverride?: unknown })
      .accompanimentOverride;
    const normalized = normalizeChordStyleOverride(rawOverride, global);
    if (normalized) {
      return { ...event, accompanimentOverride: normalized };
    }
    onInvalid?.(event, rawOverride);
    const { accompanimentOverride: _discarded, ...inherited } = event;
    return inherited;
  });
}

/** The style each chord actually plays, in progression order. */
export function resolveEffectiveStyles(
  progression: readonly ChordEvent[],
  global: EffectiveChordStyle,
): EffectiveChordStyle[] {
  return progression.map(
    (event) => normalizeChordStyleOverride(event.accompanimentOverride, global) ?? global,
  );
}

/** The distinct styles a progression needs, in first-appearance order. */
export function distinctChordStyles(styles: readonly EffectiveChordStyle[]): EffectiveChordStyle[] {
  const seen = new Set<string>();
  const distinct: EffectiveChordStyle[] = [];
  for (const style of styles) {
    const key = chordStyleKey(style);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(style);
  }
  return distinct;
}
