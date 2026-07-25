/**
 * Degree → tension catalog (Phase 5).
 * Avoid-notes do NOT remove candidates; practical / pop-first, jazz-capable.
 * Sevenths stay on a separate tab (not listed here).
 */

export type VariationId =
  | 'sus4'
  | 'add9'
  | '6'
  | 'sus2'
  | '9'
  | '11'
  | '13'
  | 'maj11'
  | 'sixNine'
  | 'maj9sharp11'
  | 'maj13sharp11'
  | 'm6nine'
  | 'm9_11'
  | 'm13_9'
  | 'm13_9_11'
  | 'nine_11'
  | 'b9'
  | 'sharp9'
  | 'sharp11'
  | 'b13'
  | 'b9b13'
  | 'sharp9b13'
  | 'thirteen_b9'
  | 'thirteen_sharp11'
  | 'alt'
  | 'm7b5_9'
  | 'm7b5_11'
  | 'm7b5_b13'
  | 'dim7_add9';

export type ChordVariationMeta = {
  id: VariationId;
  /** Pill label shown in the editor. */
  label: string;
  /** Default symbol when a degree map does not override. */
  suffix: string;
  isPro: boolean;
};

/** Flat registry for UI lookup (label / isPro). */
export const CHORD_VARIATIONS: readonly ChordVariationMeta[] = [
  { id: 'sus4', label: 'sus4', suffix: 'sus4', isPro: false },
  { id: 'add9', label: 'add9', suffix: 'add9', isPro: false },
  { id: '6', label: '6th', suffix: '6', isPro: true },
  { id: 'sus2', label: 'sus2', suffix: 'sus2', isPro: true },
  { id: '9', label: '9', suffix: '9', isPro: true },
  { id: '11', label: '11', suffix: '11', isPro: true },
  { id: '13', label: '13', suffix: '13', isPro: true },
  { id: 'maj11', label: 'maj11', suffix: 'maj11', isPro: true },
  { id: 'sixNine', label: '6/9', suffix: '6/9', isPro: true },
  { id: 'maj9sharp11', label: 'maj9(#11)', suffix: 'maj9(#11)', isPro: true },
  { id: 'maj13sharp11', label: 'maj13(#11)', suffix: 'maj13(#11)', isPro: true },
  { id: 'm6nine', label: 'm6/9', suffix: 'm6/9', isPro: true },
  { id: 'm9_11', label: 'm9(11)', suffix: 'm9(11)', isPro: true },
  { id: 'm13_9', label: 'm13(9)', suffix: 'm13(9)', isPro: true },
  { id: 'm13_9_11', label: 'm13(9,11)', suffix: 'm13(9,11)', isPro: true },
  { id: 'nine_11', label: '9(11)', suffix: 'm9(11)', isPro: true },
  { id: 'b9', label: '♭9', suffix: '7(♭9)', isPro: true },
  { id: 'sharp9', label: '♯9', suffix: '7(#9)', isPro: true },
  { id: 'sharp11', label: '♯11', suffix: '7(#11)', isPro: true },
  { id: 'b13', label: '♭13', suffix: '7(♭13)', isPro: true },
  { id: 'b9b13', label: '♭9♭13', suffix: '7(♭9,♭13)', isPro: true },
  { id: 'sharp9b13', label: '♯9♭13', suffix: '7(#9,♭13)', isPro: true },
  { id: 'thirteen_b9', label: '13(♭9)', suffix: '13(♭9)', isPro: true },
  { id: 'thirteen_sharp11', label: '13(#11)', suffix: '13(#11)', isPro: true },
  { id: 'alt', label: 'alt', suffix: '7alt', isPro: true },
  { id: 'm7b5_9', label: 'm7♭5(9)', suffix: 'm7♭5(9)', isPro: true },
  { id: 'm7b5_11', label: 'm7♭5(11)', suffix: 'm7♭5(11)', isPro: true },
  { id: 'm7b5_b13', label: 'm7♭5(♭13)', suffix: 'm7♭5(♭13)', isPro: true },
  { id: 'dim7_add9', label: 'dim7(add9)', suffix: 'dim7(add9)', isPro: true },
] as const;

/**
 * Per-degree symbol overrides. Listing a VariationId here makes it available
 * (avoid-note filtering removed — Phase 5).
 */
const DEGREE_VARIATION_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  // I
  0: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': 'maj9',
    '13': 'maj13',
    maj11: 'maj11',
    sixNine: '6/9',
    maj9sharp11: 'maj9(#11)',
    maj13sharp11: 'maj13(#11)',
  },
  // ii
  1: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'm(add9)',
    '6': 'm6',
    '9': 'm9',
    '11': 'm11',
    '13': 'm13',
    m6nine: 'm6/9',
    m9_11: 'm9(11)',
    m13_9: 'm13(9)',
    m13_9_11: 'm13(9,11)',
  },
  // iii — practical set; quality stays minor
  2: {
    sus4: 'sus4',
    add9: 'm(add9)',
    '9': 'm9',
    '11': 'm11',
    '13': 'm13',
    nine_11: 'm9(11)',
  },
  // IV
  3: {
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': 'maj9',
    '13': 'maj13',
    maj11: 'maj11',
    sixNine: '6/9',
    maj9sharp11: 'maj9(#11)',
    maj13sharp11: 'maj13(#11)',
  },
  // V
  4: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'add9',
    '6': '6',
    '9': '9',
    '11': '11',
    '13': '13',
    b9: '7(♭9)',
    sharp9: '7(#9)',
    sharp11: '7(#11)',
    b13: '7(♭13)',
    b9b13: '7(♭9,♭13)',
    sharp9b13: '7(#9,♭13)',
    thirteen_b9: '13(♭9)',
    thirteen_sharp11: '13(#11)',
    alt: '7alt',
  },
  // vi
  5: {
    sus4: 'sus4',
    sus2: 'sus2',
    add9: 'm(add9)',
    '9': 'm9',
    '11': 'm11',
    '13': 'm13',
    sixNine: 'm6/9',
    nine_11: 'm9(11)',
    m13_9: 'm13(9)',
  },
  // vii°
  6: {
    m7b5_9: 'm7♭5(9)',
    m7b5_11: 'm7♭5(11)',
    m7b5_b13: 'm7♭5(♭13)',
    dim7_add9: 'dim7(add9)',
  },
};

/** Variations offered for a degree, in button order. */
export function availableVariations(degreeIndex: number): VariationId[] {
  const map = DEGREE_VARIATION_SUFFIX[degreeIndex] ?? {};
  return CHORD_VARIATIONS.filter((v) => v.id in map).map((v) => v.id);
}

/** Concrete symbol/suffix for a degree + variation. */
export function variationSuffix(degreeIndex: number, variationId: VariationId): string {
  const fallback = CHORD_VARIATIONS.find((v) => v.id === variationId)?.suffix ?? '';
  return DEGREE_VARIATION_SUFFIX[degreeIndex]?.[variationId] ?? fallback;
}

export function variationMeta(variationId: VariationId): ChordVariationMeta {
  return CHORD_VARIATIONS.find((v) => v.id === variationId) ?? CHORD_VARIATIONS[0];
}
