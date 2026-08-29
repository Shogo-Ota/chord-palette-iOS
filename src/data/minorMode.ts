import { NATURAL_MINOR_DIATONIC } from '@/lib/musicTheory';
import type { ChordFunction, MajorKey } from '@/types';

/**
 * Reading a tonic as natural minor: how the scale is spelled, what each degree is
 * called, and which quality sits on it.
 *
 * The degree table is *derived* from `NATURAL_MINOR_DIATONIC` (養父貴 Part 2 /
 * ナチュラル・マイナー) rather than restated here, so the book stays the single source
 * for which chord sits on which step. Only two things are this module's own: the note
 * spellings, which are orthography rather than theory, and a function for the two
 * degrees the book deliberately leaves unassigned (see {@link MINOR_DEGREE_FUNCTIONS}).
 */

/**
 * Natural-minor spellings for the 12 supported tonics.
 *
 * Three tonics are respelled enharmonically. `D♭`, `G♭` and `A♭` minor would need
 * double flats (D♭ E♭ F♭ G♭ A♭ B♭♭ C♭), which no score writes, so they appear as their
 * conventional sharp equivalents C♯ / F♯ / G♯ minor. The tonic *pitch class* is
 * unchanged — only the letters differ — so transposition and audio are unaffected.
 */
export const MINOR_SCALES: Record<
  MajorKey,
  readonly [string, string, string, string, string, string, string]
> = {
  C: ['C', 'D', 'E♭', 'F', 'G', 'A♭', 'B♭'],
  'D♭': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
  D: ['D', 'E', 'F', 'G', 'A', 'B♭', 'C'],
  'E♭': ['E♭', 'F', 'G♭', 'A♭', 'B♭', 'C♭', 'D♭'],
  E: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  F: ['F', 'G', 'A♭', 'B♭', 'C', 'D♭', 'E♭'],
  'G♭': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
  G: ['G', 'A', 'B♭', 'C', 'D', 'E♭', 'F'],
  'A♭': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
  A: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'B♭': ['B♭', 'C', 'D♭', 'E♭', 'F', 'G♭', 'A♭'],
  B: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
};

/**
 * Minor keys whose signature uses sharps, so chromatic notes outside the scale are
 * spelled with # rather than ♭. A minor key takes its relative major's signature
 * (tonic + 3 semitones): C♯m→E, Em→G, F♯m→A, G♯m→B, Bm→D are the sharp ones.
 * A minor has no accidentals and follows the flat table, matching how C major is
 * handled on the major side.
 */
export const MINOR_SHARP_KEYS: readonly MajorKey[] = ['D♭', 'E', 'G♭', 'A♭', 'B'];

/** Tonic as it is written in minor (e.g. `A♭` → `G#`). */
export function minorTonicName(key: MajorKey): string {
  return MINOR_SCALES[key][0];
}

/** Semitones above the tonic for each natural-minor degree (i..♭VII). */
export const MINOR_SCALE_OFFSETS: readonly number[] = NATURAL_MINOR_DIATONIC.map(
  (rule) => rule.rootOffset,
);

/**
 * Degree index (0 = i … 6 = ♭VII) for a root offset, or -1 when the root is outside
 * the natural-minor scale. Mirrors `degreeIndexFromRootOffset` on the major side.
 */
export function minorDegreeIndexFromRootOffset(rootOffset: number): number {
  return MINOR_SCALE_OFFSETS.indexOf(((rootOffset % 12) + 12) % 12);
}

/**
 * Roman-numeral labels in the app's orthography. The theory DB writes ASCII (`iiø`,
 * `bIII`); the UI has always used ♭ and ° (`vii°` on the major side), so the two
 * differ only in typography.
 */
export const MINOR_DEGREE_LABELS: readonly string[] = [
  'i',
  'ii°',
  '♭III',
  'iv',
  'v',
  '♭VI',
  '♭VII',
];

/**
 * Harmonic function per minor degree, used only for the card's colour.
 *
 * Five come straight from the book. The natural-minor `v` and `♭VII` carry no function
 * in the source — the book declines to assign one, and `DiatonicDegreeRule.function` is
 * optional for exactly that reason — but `ChordFunction` is required to colour a card.
 * The two fallbacks are therefore Chord Palette policy, not the book's claim: `v` keeps
 * the dominant slot it occupies by position, and `♭VII` is grouped with the
 * subdominants it behaves like when it approaches the tonic from below.
 */
const APP_POLICY_FUNCTION: Record<string, ChordFunction> = {
  v: 'dominant',
  bVII: 'subdominant',
};

const FUNCTION_NAMES: Record<string, ChordFunction> = {
  TONIC: 'tonic',
  SUBDOMINANT: 'subdominant',
  DOMINANT: 'dominant',
};

export const MINOR_DEGREE_FUNCTIONS: readonly ChordFunction[] = NATURAL_MINOR_DIATONIC.map(
  (rule) =>
    (rule.function ? FUNCTION_NAMES[rule.function] : APP_POLICY_FUNCTION[rule.degree]) ?? 'tonic',
);

/** Theory quality → the suffix string the chord catalog and display names use. */
const QUALITY_SUFFIX: Record<string, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  maj7: 'maj7',
  min7: 'm7',
  min7b5: 'm7♭5',
  '7': '7',
};

function suffixFor(quality: string, degree: string): string {
  const suffix = QUALITY_SUFFIX[quality];
  if (suffix == null) {
    throw new Error(`No suffix mapping for natural-minor ${degree} quality "${quality}"`);
  }
  return suffix;
}

/** Diatonic triad suffixes per minor degree (i → 'm', ii° → 'dim', ♭III → '', …). */
export const MINOR_TRIAD_SUFFIXES: readonly string[] = NATURAL_MINOR_DIATONIC.map((rule) =>
  suffixFor(rule.triad, rule.degree),
);

/** Diatonic seventh suffixes per minor degree (i → 'm7', ii° → 'm7♭5', …). */
export const MINOR_SEVENTH_SUFFIXES: readonly string[] = NATURAL_MINOR_DIATONIC.map((rule) =>
  suffixFor(rule.seventh, rule.degree),
);
