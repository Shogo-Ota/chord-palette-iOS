/**
 * Which variation pills the editor shows for the chord the player has selected.
 *
 * The tiers exist because the catalog grew past what a first row can hold, and
 * because they are not equally safe to reach for:
 *
 *  - core     — the short familiar set, always visible.
 *  - extended — richer colours, still inside the key and clear of every avoid
 *               note. Folded away until asked for.
 *  - altered  — the tensions classic theory names for the degree that leave the
 *               key or rub against a chord tone. Shown last, under the same
 *               disclosure as the extended tier but its own heading.
 *
 * Pure and UI-independent: the screen decides how a pill looks, this decides which
 * pills exist, what they would produce, and whether the player may place them.
 */

import {
  ALL_VARIATIONS,
  alteredVariations,
  availableVariations,
  extendedVariations,
  variationChord,
  type VariationId,
} from '@/data/music';
import { isLocked, type Entitlements } from '@/lib/entitlements';
import type { ChordEvent, MajorKey } from '@/types';

/** A single pill: its caption, the chord it would produce, and its two states. */
export interface VariationPillModel {
  id: VariationId;
  label: string;
  /** The chord this pill would produce in the current key, e.g. "Cmaj9(#11)". */
  preview: string;
  active: boolean;
  locked: boolean;
}

export interface VariationTiers {
  core: VariationPillModel[];
  extended: VariationPillModel[];
  altered: VariationPillModel[];
}

export interface VariationPillsInput {
  key: MajorKey;
  /** Scale degree of the selected chord, or a negative value when it is not diatonic. */
  degree: number;
  selected: ChordEvent | undefined;
  entitlements: Entitlements;
}

function toPill(input: VariationPillsInput, id: VariationId): VariationPillModel {
  const meta = ALL_VARIATIONS.find((v) => v.id === id)!;
  const preview = variationChord(input.key, input.degree, id);
  return {
    id,
    label: meta.label,
    preview: preview.displayName,
    // Match on the id where the event records one, and on the resulting quality
    // otherwise, so a chord picked before variations were tracked still lights up.
    active: input.selected?.variation === id || input.selected?.suffix === preview.suffix,
    locked: isLocked(meta.isPro, input.entitlements),
  };
}

/**
 * Every tier for the selected degree. A non-diatonic selection has no degree to
 * decorate, so they all come back empty.
 */
export function variationTiers(input: VariationPillsInput): VariationTiers {
  if (input.degree < 0) return { core: [], extended: [], altered: [] };
  return {
    core: availableVariations(input.degree).map((id) => toPill(input, id)),
    extended: extendedVariations(input.degree).map((id) => toPill(input, id)),
    altered: alteredVariations(input.degree).map((id) => toPill(input, id)),
  };
}
