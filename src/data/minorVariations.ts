import {
  ALL_VARIATIONS,
  CHORD_VARIATIONS,
  EXTENDED_VARIATIONS,
  variationChord,
  type VariationId,
} from '@/data/music';
import {
  MINOR_DEGREE_FUNCTIONS,
  MINOR_DEGREE_LABELS,
  MINOR_SCALE_OFFSETS,
  MINOR_SCALES,
} from '@/data/minorMode';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { KeyMode, LibraryChord, MajorKey } from '@/types';

/**
 * Natural-minor variation mappings.
 *
 * Available and avoid tensions come from `NATURAL_MINOR_TENSIONS`. Sus/add forms are
 * included only when every sounding pitch stays in the natural-minor collection.
 * Tiers retain the existing product meaning:
 *
 * - core: familiar, in-key forms
 * - extended: richer available tensions, still in-key
 * - altered: explicit avoid-note colours, kept behind the warning disclosure
 */
const CORE_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'm(add9)',
    '9': 'm9',
    '11': 'm11',
  },
  1: {},
  2: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': 'maj9',
    '13': 'maj13',
  },
  3: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'm(add9)',
    '6': 'm6',
    '9': 'm9',
    '11': 'm11',
    '13': 'm13',
  },
  4: {
    sus4: 'sus4',
    // `m11` would also add a natural 9, which is outside this Phrygian degree.
    '11': 'm(add11)',
  },
  5: {
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': 'maj9',
    '13': 'maj13',
  },
  6: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': '9',
    '13': '13',
  },
};

const EXTENDED_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: {},
  1: {
    m7b5_11: 'm7♭5(11)',
    m7b5_b13: 'm7♭5(♭13)',
  },
  2: { sixNine: '6/9' },
  3: {
    m6nine: 'm6/9',
    m13_9_11: 'm13(9,11)',
  },
  4: {},
  5: {
    sixNine: '6/9',
    maj9sharp11: 'maj9(#11)',
    maj13sharp11: 'maj13(#11)',
  },
  6: {},
};

const ALTERED_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: { m7b13: 'm7(♭13)' },
  1: { m7b5_b9: 'm7♭5(♭9)' },
  2: {},
  // iv's avoid is ♮13; the catalog has no dedicated m7(13) form.
  3: {},
  4: {
    m7b9: 'm7(♭9)',
    m7b13: 'm7(♭13)',
  },
  5: {},
  // ♭VII's avoid is ♮11; sus4 replaces the 3rd and remains a core form.
  6: {},
};

const ALL_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = Object.fromEntries(
  Array.from({ length: 7 }, (_, degree) => [
    degree,
    {
      ...CORE_SUFFIX[degree],
      ...EXTENDED_SUFFIX[degree],
      ...ALTERED_SUFFIX[degree],
    },
  ]),
);

export function minorAvailableVariations(degree: number): VariationId[] {
  const map = CORE_SUFFIX[degree] ?? {};
  return CHORD_VARIATIONS.filter((variation) => variation.id in map).map(
    (variation) => variation.id,
  );
}

export function minorExtendedVariations(degree: number): VariationId[] {
  const map = EXTENDED_SUFFIX[degree] ?? {};
  return EXTENDED_VARIATIONS.filter((variation) => variation.id in map).map(
    (variation) => variation.id,
  );
}

export function minorAlteredVariations(degree: number): VariationId[] {
  const map = ALTERED_SUFFIX[degree] ?? {};
  return ALL_VARIATIONS.filter((variation) => variation.id in map).map((variation) => variation.id);
}

export function minorVariationChord(
  key: MajorKey,
  degree: number,
  variationId: VariationId,
): LibraryChord {
  const root = MINOR_SCALES[key][degree];
  const variation = ALL_VARIATIONS.find((item) => item.id === variationId) ?? ALL_VARIATIONS[0];
  const suffix = ALL_SUFFIX[degree]?.[variationId] ?? variation.suffix;

  return {
    id: `var-${key}-minor-${root}-${suffix}`,
    displayName: `${root}${suffix}`,
    degreeLabel: `${MINOR_DEGREE_LABELS[degree]} ${variation.label}`,
    function: MINOR_DEGREE_FUNCTIONS[degree],
    subLabel: variation.label,
    category: 'variation',
    variation: variation.id,
    isPro: variation.isPro,
    rootOffset: MINOR_SCALE_OFFSETS[degree],
    suffix,
    definitionId: definitionIdForSuffix(suffix),
  };
}

/** Stable mode adapter; major remains delegated to its frozen implementation. */
export function variationChordForMode(
  key: MajorKey,
  degree: number,
  variationId: VariationId,
  mode: KeyMode,
): LibraryChord {
  return mode === 'minor'
    ? minorVariationChord(key, degree, variationId)
    : variationChord(key, degree, variationId);
}
