import { MAJOR_SCALE_OFFSETS } from '@/data/music';
import { MINOR_SCALE_OFFSETS } from '@/data/minorMode';
import { getDefinitionBySymbol } from '@/lib/theory/definitions';
import type { ChordRootSpelling, KeyMode } from '@/types';

/**
 * The Roman-numeral degree label for a chord, read in the key its offsets refer to.
 *
 * Two questions, answered separately. *Which degree* comes from the root — from
 * `rootSpelling` when the chord's rule stated one, because `#V` and `♭VI` are the same
 * pitch and not the same claim, and only the rule knows which it meant. *How to write the
 * numeral* comes from the chord quality: minor and diminished chords take a lowercase
 * numeral, everything else uppercase, which is the convention a reader of Roman numerals
 * already expects.
 *
 * Quality is read from the chord catalog rather than parsed out of the suffix, so no label
 * depends on guessing what a symbol means. An unknown symbol keeps its numeral uppercase
 * and appends nothing, which is wrong quietly rather than wrong loudly.
 */

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/**
 * The direction the app names each chromatic major-key degree with, matching
 * {@link CHROMATIC}. Used when a rebase lands on a chromatic pitch with no direction of its
 * own to carry forward.
 */
const CHROMATIC_ALTERATION: Readonly<Record<number, -1 | 1>> = {
  1: -1,
  3: -1,
  6: 1,
  8: -1,
  10: -1,
};

/** Degrees outside the scale, named by the direction the app already uses elsewhere. */
const CHROMATIC: Readonly<Record<number, string>> = {
  1: '♭II',
  3: '♭III',
  6: '#IV',
  8: '♭VI',
  10: '♭VII',
};

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

function scaleOffsets(mode: KeyMode): readonly number[] {
  return mode === 'minor' ? MINOR_SCALE_OFFSETS : MAJOR_SCALE_OFFSETS;
}

/** Qualities whose numeral is written in lower case. */
function isLowerCaseQuality(suffix: string): boolean {
  const quality = getDefinitionBySymbol(suffix)?.quality;
  return quality === 'minor' || quality === 'diminished' || quality === 'halfDim';
}

/**
 * What to write after the numeral.
 *
 * A minor chord's numeral already says it is minor, so the `m` is dropped rather than
 * printed twice: `m7` on the fourth degree is `iv7`, not `ivm7`. `dim` becomes the degree
 * sign for the same reason — the lower-case numeral and the ° both say diminished, and the
 * ° is the part a reader looks for.
 */
function numeralSuffix(suffix: string): string {
  if (suffix === '') return '';
  const quality = getDefinitionBySymbol(suffix)?.quality;
  if (quality === 'diminished') return suffix.replace(/^dim/, '°');
  if (quality === 'minor' || quality === 'halfDim') return suffix.replace(/^m/, '');
  return suffix;
}

function applyCase(numeral: string, lower: boolean): string {
  return lower ? numeral.toLowerCase() : numeral;
}

/**
 * The degree a root sits on, preferring what the chord's rule said over what its pitch
 * alone would suggest.
 */
function degreeRoot(
  rootOffset: number,
  rootSpelling: ChordRootSpelling | undefined,
  mode: KeyMode,
): string {
  if (rootSpelling) {
    const accidental =
      rootSpelling.alteration > 0 ? '#' : rootSpelling.alteration < 0 ? '♭' : '';
    return `${accidental}${NUMERALS[rootSpelling.degreeIndex] ?? NUMERALS[0]}`;
  }
  const index = scaleOffsets(mode).indexOf(wrap(rootOffset));
  if (index >= 0) return NUMERALS[index]!;
  return CHROMATIC[wrap(rootOffset)] ?? NUMERALS[0]!;
}

export interface DegreeLabelInput {
  rootOffset: number;
  suffix: string;
  /** Present when the chord's rule stated which degree it meant. */
  rootSpelling?: ChordRootSpelling;
  /** Semitones of the bass above the tonic, for slash chords. */
  bassOffset?: number;
}

export function chordDegreeLabel(chord: DegreeLabelInput, mode: KeyMode = 'major'): string {
  // A rule-stated degree names a scale position rather than the chord built on it — `#V°7`
  // is "the diminished seventh on the sharpened fifth", where `°7` already carries the
  // quality and the numeral carries the position. A degree derived from pitch alone has
  // nothing but the chord to name, so there the usual quality casing applies.
  const lower = chord.rootSpelling == null && isLowerCaseQuality(chord.suffix);
  const base = `${applyCase(degreeRoot(chord.rootOffset, chord.rootSpelling, mode), lower)}${numeralSuffix(chord.suffix)}`;
  if (chord.bassOffset == null) return base;
  const bass = degreeRoot(chord.bassOffset, undefined, mode);
  return `${base}/${bass}`;
}

/**
 * Re-spell a degree against a new tonic while keeping the pitch and the direction.
 *
 * `#V` in C and `#I` in G are the same sounding note, and both are sharps of a scale
 * degree — that much has to survive a key change or the label starts disagreeing with the
 * chord. Where the new pitch is itself a scale degree the accidental is dropped, because
 * spelling a plain diatonic root as `♭I` or `#III` would be preserving a direction that no
 * longer has anything to point away from.
 */
export function respellDegree(
  rootSpelling: ChordRootSpelling,
  semitoneShift: number,
  mode: KeyMode = 'major',
): ChordRootSpelling {
  const offsets = scaleOffsets(mode);
  const currentPitchClass = wrap(
    (offsets[rootSpelling.degreeIndex] ?? 0) + rootSpelling.alteration,
  );
  const pitchClass = wrap(currentPitchClass + semitoneShift);

  const diatonic = offsets.indexOf(pitchClass);
  if (diatonic >= 0) return { degreeIndex: diatonic, alteration: 0 };

  // Carry the chord's own direction forward while it still lands on a degree, so a sharpened
  // fifth stays a sharpened something rather than flipping to a flattened neighbour.
  //
  // A spelling that passed through a natural degree on the way has no direction left to
  // carry: once `♭III` in C becomes `I` in E♭, nothing records that it used to be a flat.
  // Coming back out, the app's own naming for that pitch is the best answer available, which
  // is why a round trip preserves the pitch but not always the spelling.
  const preferred: (-1 | 1)[] =
    rootSpelling.alteration !== 0
      ? [rootSpelling.alteration, CHROMATIC_ALTERATION[pitchClass] ?? -1, 1, -1]
      : [CHROMATIC_ALTERATION[pitchClass] ?? -1, -1, 1];
  for (const alteration of preferred) {
    const index = offsets.indexOf(wrap(pitchClass - alteration));
    if (index >= 0) return { degreeIndex: index, alteration };
  }
  return rootSpelling;
}
