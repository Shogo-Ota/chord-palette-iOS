/**
 * Which variation pills the editor shows for the chord the player has selected.
 *
 * The rows come straight from each variation's `usability`, because the reason to
 * fold something away is how safely it can be reached for, not how exotic theory
 * considers it:
 *
 *  - core     — the always-visible row. Safe in any voicing.
 *  - extended — richer colour with the same promise. Folded away until asked for.
 *  - strong   — 強い色づけ. A deliberate character: outside the key, or inside it
 *               with a semitone rub. Shown last, under its own heading.
 *
 * Pure and UI-independent: the screen decides how a pill looks, this decides which
 * pills exist, what they would produce, and whether the player may place them.
 */

import { ALL_VARIATIONS, type DegreeVariation, type VariationId } from '@/data/music';
import { degreeVariationsForMode, variationChordForMode } from '@/data/minorVariations';
import { isLocked, type Entitlements } from '@/lib/entitlements';
import type { ChordEvent, KeyMode, MajorKey } from '@/types';

/** A single pill: its caption, the chord it would produce, and its two states. */
export interface VariationPillModel {
  id: VariationId;
  /** Caption, matching the quality it produces on this degree — `m9` for `Dm9`. */
  label: string;
  /** The chord this pill would produce in the current key, e.g. "Cmaj9(#11)". */
  preview: string;
  active: boolean;
  locked: boolean;
  /**
   * Why this colour is what it is. Not shown to the player — carried so a later
   * context-aware ranker can order these without re-deriving the theory.
   */
  colorClass: DegreeVariation['colorClass'];
  scaleCompatibility: DegreeVariation['scaleCompatibility'];
  dissonanceLevel: DegreeVariation['dissonanceLevel'];
  tensionClass?: string;
}

export interface VariationTiers {
  core: VariationPillModel[];
  extended: VariationPillModel[];
  strong: VariationPillModel[];
}

export interface VariationPillsInput {
  key: MajorKey;
  mode: KeyMode;
  /** Scale degree of the selected chord, or a negative value when it is not diatonic. */
  degree: number;
  selected: ChordEvent | undefined;
  entitlements: Entitlements;
}

function toPill(input: VariationPillsInput, entry: DegreeVariation): VariationPillModel {
  const isPro = ALL_VARIATIONS.find((v) => v.id === entry.id)?.isPro ?? true;
  const preview = variationChordForMode(input.key, input.degree, entry.id, input.mode);
  return {
    id: entry.id,
    label: entry.label,
    preview: preview.displayName,
    // Match on the id where the event records one, and on the resulting quality
    // otherwise, so a chord picked before variations were tracked still lights up.
    active: input.selected?.variation === entry.id || input.selected?.suffix === preview.suffix,
    locked: isLocked(isPro, input.entitlements),
    colorClass: entry.colorClass,
    scaleCompatibility: entry.scaleCompatibility,
    dissonanceLevel: entry.dissonanceLevel,
    tensionClass: entry.tensionClass,
  };
}

/**
 * Every tier for the selected degree. A non-diatonic selection has no degree to
 * decorate, so they all come back empty.
 */
export function variationTiers(input: VariationPillsInput): VariationTiers {
  if (input.degree < 0) return { core: [], extended: [], strong: [] };
  const offered = degreeVariationsForMode(input.degree, input.mode);
  const rowFor = (usability: DegreeVariation['usability']) =>
    offered.filter((entry) => entry.usability === usability).map((entry) => toPill(input, entry));

  return {
    core: rowFor('primary'),
    extended: rowFor('secondary'),
    strong: rowFor('advanced'),
  };
}
