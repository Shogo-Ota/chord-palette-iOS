/**
 * Which variation pills the editor shows for the chord the player has selected.
 *
 * The two tiers exist because the catalog grew past what a first row can hold: the
 * core tier is the short familiar set, the extended tier the richer colours that
 * stay folded away until asked for. Both are filtered the same way — only tensions
 * that keep the degree's quality and stay inside the key ever reach the screen.
 *
 * Pure and UI-independent: the screen decides how a pill looks, this decides which
 * pills exist, what they would produce, and whether the player may place them.
 */

import {
  ALL_VARIATIONS,
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
 * Both tiers for the selected degree. A non-diatonic selection has no degree to
 * decorate, so both come back empty.
 */
export function variationTiers(input: VariationPillsInput): VariationTiers {
  if (input.degree < 0) return { core: [], extended: [] };
  return {
    core: availableVariations(input.degree).map((id) => toPill(input, id)),
    extended: extendedVariations(input.degree).map((id) => toPill(input, id)),
  };
}
