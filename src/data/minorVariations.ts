import {
  ALL_VARIATIONS,
  degreeVariations,
  variationChord,
  variationOffer,
  type DegreeVariation,
  type VariationId,
  type VariationUsability,
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
 * What each natural-minor degree offers, in the order the editor shows it.
 *
 * Which chords appear comes from `NATURAL_MINOR_TENSIONS`, unchanged: sus/add forms
 * are listed only when every sounding pitch stays in the natural-minor collection,
 * and each degree's avoid tension is held back under 強い色づけ. What changed here
 * is presentation only — captions now read as the quality they produce, so `Cm9` is
 * captioned `m9` rather than `9`, and the ladder runs sus → 6 → 9 → 11 → 13 like
 * the major table does.
 *
 * The major spec's candidate rework has no natural-minor counterpart yet, so this
 * table deliberately keeps its existing chords.
 */
const MINOR_DEGREE_VARIATIONS: readonly (readonly DegreeVariation[])[] = [
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'm(add9)', 'primary', { tensionClass: '9' }),
    variationOffer('9', 'm9', 'm9', 'secondary', { tensionClass: '9' }),
    variationOffer('11', 'm11', 'm11', 'secondary', { tensionClass: '11' }),
    variationOffer('m7b13', 'm7(♭13)', 'm7(♭13)', 'advanced', {
      colorClass: 'minorColor',
      dissonanceLevel: 'high',
      tensionClass: 'b13',
    }),
  ],
  [
    variationOffer('m7b5_11', 'm7♭5(11)', 'm7♭5(11)', 'secondary', { tensionClass: '11' }),
    variationOffer('m7b5_b13', 'm7♭5(♭13)', 'm7♭5(♭13)', 'secondary', {
      colorClass: 'diminishedColor',
      dissonanceLevel: 'medium',
      tensionClass: 'b13',
    }),
    variationOffer('m7b5_b9', 'm7♭5(♭9)', 'm7♭5(♭9)', 'advanced', {
      colorClass: 'diminishedColor',
      dissonanceLevel: 'high',
      tensionClass: 'b9',
    }),
  ],
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'add9', 'primary', { tensionClass: '9' }),
    variationOffer('6', '6', '6', 'primary', { tensionClass: '6' }),
    variationOffer('sixNine', '6/9', '6/9', 'secondary', { tensionClass: '6/9' }),
    variationOffer('9', 'maj9', 'maj9', 'secondary', { tensionClass: '9' }),
    variationOffer('13', 'maj13', 'maj13', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
  ],
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'm(add9)', 'primary', { tensionClass: '9' }),
    variationOffer('6', 'm6', 'm6', 'primary', { tensionClass: '6' }),
    variationOffer('m6nine', 'm6/9', 'm6/9', 'secondary', { tensionClass: '6/9' }),
    variationOffer('9', 'm9', 'm9', 'secondary', { tensionClass: '9' }),
    variationOffer('11', 'm11', 'm11', 'secondary', { tensionClass: '11' }),
    variationOffer('13', 'm13', 'm13', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
    variationOffer('m13_9_11', 'm13(9,11)', 'm13(9,11)', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
  ],
  [
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    // `m11` would also add a natural 9, which is outside this Phrygian degree.
    variationOffer('11', 'm(add11)', 'm(add11)', 'primary', { tensionClass: '11' }),
    variationOffer('m7b9', 'm7(♭9)', 'm7(♭9)', 'advanced', {
      colorClass: 'minorColor',
      dissonanceLevel: 'high',
      tensionClass: 'b9',
    }),
    variationOffer('m7b13', 'm7(♭13)', 'm7(♭13)', 'advanced', {
      colorClass: 'minorColor',
      dissonanceLevel: 'high',
      tensionClass: 'b13',
    }),
  ],
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('add9', 'add9', 'add9', 'primary', { tensionClass: '9' }),
    variationOffer('6', '6', '6', 'primary', { tensionClass: '6' }),
    variationOffer('sixNine', '6/9', '6/9', 'secondary', { tensionClass: '6/9' }),
    variationOffer('9', 'maj9', 'maj9', 'secondary', { tensionClass: '9' }),
    variationOffer('13', 'maj13', 'maj13', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
    variationOffer('maj9sharp11', 'maj9(#11)', 'maj9(#11)', 'advanced', {
      colorClass: 'lydian',
      dissonanceLevel: 'medium',
      tensionClass: '#11',
    }),
    variationOffer('maj13sharp11', 'maj13(#11)', 'maj13(#11)', 'advanced', {
      colorClass: 'lydian',
      dissonanceLevel: 'medium',
      tensionClass: '#11',
    }),
  ],
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    // ♭VII's avoid is ♮11; sus4 replaces the 3rd and remains a safe form.
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'add9', 'primary', { tensionClass: '9' }),
    variationOffer('6', '6', '6', 'primary', { tensionClass: '6' }),
    variationOffer('9', '9', '9', 'secondary', { tensionClass: '9' }),
    variationOffer('13', '13', '13', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
  ],
];

/** What the given natural-minor degree offers, in display order. */
export function minorDegreeVariations(degree: number): readonly DegreeVariation[] {
  return MINOR_DEGREE_VARIATIONS[degree] ?? [];
}

function minorIdsByUsability(degree: number, usability: VariationUsability): VariationId[] {
  return minorDegreeVariations(degree)
    .filter((entry) => entry.usability === usability)
    .map((entry) => entry.id);
}

export function minorAvailableVariations(degree: number): VariationId[] {
  return minorIdsByUsability(degree, 'primary');
}

export function minorExtendedVariations(degree: number): VariationId[] {
  return minorIdsByUsability(degree, 'secondary');
}

export function minorStrongVariations(degree: number): VariationId[] {
  return minorIdsByUsability(degree, 'advanced');
}

export function minorVariationChord(
  key: MajorKey,
  degree: number,
  variationId: VariationId,
): LibraryChord {
  const root = MINOR_SCALES[key][degree];
  const registry = ALL_VARIATIONS.find((item) => item.id === variationId) ?? ALL_VARIATIONS[0];
  const entry = minorDegreeVariations(degree).find((item) => item.id === variationId);
  const suffix = entry?.suffix ?? registry.suffix;
  const label = entry?.label ?? registry.label;

  return {
    id: `var-${key}-minor-${root}-${suffix}`,
    displayName: `${root}${suffix}`,
    degreeLabel: `${MINOR_DEGREE_LABELS[degree]} ${label}`,
    function: MINOR_DEGREE_FUNCTIONS[degree],
    subLabel: label,
    category: 'variation',
    variation: registry.id,
    isPro: registry.isPro,
    rootOffset: MINOR_SCALE_OFFSETS[degree],
    suffix,
    definitionId: definitionIdForSuffix(suffix),
  };
}

/** Stable mode adapter; major remains delegated to its own table. */
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

/** What the given degree offers in the given mode, in display order. */
export function degreeVariationsForMode(
  degree: number,
  mode: KeyMode,
): readonly DegreeVariation[] {
  return mode === 'minor' ? minorDegreeVariations(degree) : degreeVariations(degree);
}
