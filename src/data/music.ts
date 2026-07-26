import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { ChordFunction, DiatonicChord, LibraryChord, MajorKey } from '@/types';

/**
 * Major-scale note spellings for the 12 supported keys.
 * Flats use ♭, sharps use # (matching the mockup's conventions).
 */
const MAJOR_SCALES: Record<MajorKey, [string, string, string, string, string, string, string]> = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'D♭': ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
  D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
  'E♭': ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
  E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
  F: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
  'G♭': ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  'A♭': ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
  A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
  'B♭': ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
  B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
};

/** The 12 keys in selector order (requirements §5.2). */
export const MAJOR_KEYS: MajorKey[] = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
];

/** Roman-numeral degree labels (as shown under each chord card in the mock). */
const DEGREE_LABELS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;

/** Semitones above the tonic for each major-scale degree (I..vii). */
export const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const;

/** Diatonic degree index (0 = I … 6 = vii°) for a root offset, or -1 if non-diatonic. */
export function degreeIndexFromRootOffset(rootOffset: number): number {
  const pc = ((rootOffset % 12) + 12) % 12;
  return (MAJOR_SCALE_OFFSETS as readonly number[]).indexOf(pc);
}

/** Fixed harmonic function per scale degree in a major key. */
const DEGREE_FUNCTIONS: ChordFunction[] = [
  'tonic', // I
  'subdominant', // ii
  'tonic', // iii
  'subdominant', // IV
  'dominant', // V
  'tonic', // vi
  'dominant', // vii°
];

/** Suffixes for diatonic seventh chords per degree. */
const SEVENTH_SUFFIXES = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7♭5'] as const;
/** Suffixes for diatonic triads per degree. */
export const TRIAD_SUFFIXES = ['', 'm', 'm', '', '', 'm', 'dim'] as const;

function build(key: MajorKey, suffixes: readonly string[]): DiatonicChord[] {
  const scale = MAJOR_SCALES[key];
  return scale.map((root, i) => {
    const displayName = `${root}${suffixes[i]}`;
    return {
      id: displayName,
      displayName,
      degreeLabel: DEGREE_LABELS[i],
      function: DEGREE_FUNCTIONS[i],
      rootOffset: MAJOR_SCALE_OFFSETS[i],
      suffix: suffixes[i],
      definitionId: definitionIdForSuffix(suffixes[i]),
    };
  });
}

/** Diatonic seventh chords for the given key (e.g. C → Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5). */
export function diatonicSevenths(key: MajorKey): DiatonicChord[] {
  return build(key, SEVENTH_SUFFIXES);
}

/** Diatonic triads for the given key (e.g. C → C Dm Em F G Am Bdim). */
export function diatonicTriads(key: MajorKey): DiatonicChord[] {
  return build(key, TRIAD_SUFFIXES);
}

/** Color-extension chords available on top of the basic set (requirements §5.3). */
export const COLOR_CHORDS = [
  { id: 'sus4', label: 'sus4' },
  { id: 'add9', label: 'add9' },
] as const;

/* ------------------------------------------------------------------ */
/* Chromatic helpers (for borrowed / secondary / slash spellings)      */
/* ------------------------------------------------------------------ */

/** Absolute pitch-class (0 = C) for every note spelling we produce. */
const NOTE_PC: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  'D♭': 1,
  D: 2,
  'D#': 3,
  'E♭': 3,
  E: 4,
  'F♭': 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  'G♭': 6,
  G: 7,
  'G#': 8,
  'A♭': 8,
  A: 9,
  'A#': 10,
  'B♭': 10,
  B: 11,
  'C♭': 11,
};

/** Flat-spelled chromatic scale (default for flat keys + C). */
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
/** Sharp-spelled chromatic scale (used for sharp keys). */
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
/** Keys whose signature uses sharps → spell chromatic notes with sharps. */
const SHARP_KEYS: MajorKey[] = ['G', 'D', 'A', 'E', 'B'];

function chromaticName(key: MajorKey, pc: number): string {
  const table = SHARP_KEYS.includes(key) ? SHARP_NAMES : FLAT_NAMES;
  return table[((pc % 12) + 12) % 12];
}

/** Pitch class of the key's tonic. */
function tonicPc(key: MajorKey): number {
  return NOTE_PC[MAJOR_SCALES[key][0]];
}

/** Pitch class (0 = C) of the key's tonic — used by audio voicing to build MIDI notes. */
export function keyTonicPc(key: MajorKey): number {
  return tonicPc(key);
}

/** Note name `offset` semitones above the tonic, spelled for the key. */
export function noteAt(key: MajorKey, offset: number): string {
  return chromaticName(key, tonicPc(key) + offset);
}

/** Note name (no octave) of a MIDI note, spelled for the key. Used by the keyboard visual. */
export function midiNoteName(key: MajorKey, midi: number): string {
  return chromaticName(key, midi);
}

/** Semitones a spelled note sits above the key's tonic (0..11). */
export function offsetFromTonic(key: MajorKey, note: string): number {
  return (((NOTE_PC[note] ?? 0) - tonicPc(key)) % 12 + 12) % 12;
}

/**
 * Roman-numeral degree name for each semitone offset above the tonic (0..11).
 * Uppercase because a *bass degree* denotes a scale-degree position, not a chord
 * quality. Chromatic degrees use ♭/# to match the app's existing degree labels
 * (e.g. modal interchange already uses ♭III / ♭VI / ♭VII). Key-invariant.
 */
const CHROMATIC_DEGREE_LABELS = [
  'I',
  '♭II',
  'II',
  '♭III',
  'III',
  'IV',
  '#IV',
  'V',
  '♭VI',
  'VI',
  '♭VII',
  'VII',
] as const;

/**
 * Roman-numeral degree label for a semitone offset above the tonic (0..11).
 * Used for slash/on-chord bass denominators so they read as degrees (e.g. C/E in
 * C → "I/III") rather than absolute note names, and stay correct across keys.
 */
export function degreeLabelFromOffset(offset: number): string {
  return CHROMATIC_DEGREE_LABELS[(((offset ?? 0) % 12) + 12) % 12];
}

/**
 * Degree label for a chord ROOT `offset` semitones above the tonic. Diatonic roots
 * get the quality-aware label (I, ii, iii, IV, V, vi, vii°); chromatic roots fall
 * back to the plain Roman degree (♭III, #IV, …). Used when re-labelling a recalled
 * progression relative to the current key (append feature).
 */
export function rootDegreeLabel(offset: number): string {
  const idx = degreeIndexFromRootOffset(offset);
  return idx >= 0 ? DEGREE_LABELS[idx] : degreeLabelFromOffset(offset);
}

/* ------------------------------------------------------------------ */
/* Library: diatonic (triad main + 7th pill)                           */
/* ------------------------------------------------------------------ */

/**
 * Diatonic library cards for a key: big name = triad (C, Dm…),
 * sub-label = the diatonic seventh (Cmaj7, Dm7…).
 */
export function diatonicLibrary(key: MajorKey): LibraryChord[] {
  const triads = diatonicTriads(key);
  const sevenths = diatonicSevenths(key);
  return triads.map((t, i) => ({
    id: `dia-${t.id}-${key}`,
    displayName: t.displayName,
    degreeLabel: t.degreeLabel,
    function: t.function,
    subLabel: sevenths[i].displayName,
    category: 'diatonic',
    isPro: false,
    rootOffset: t.rootOffset,
    suffix: t.suffix,
    definitionId: t.definitionId,
  }));
}

/**
 * Diatonic library cards where the big name is the seventh chord (Cmaj7, Dm7…)
 * and the sub-label is the plain triad. Free tier — lets users place 4-note
 * diatonic chords directly (the triad grid keeps the sub-label as the seventh).
 */
export function diatonicSeventhLibrary(key: MajorKey): LibraryChord[] {
  const triads = diatonicTriads(key);
  const sevenths = diatonicSevenths(key);
  return sevenths.map((s, i) => ({
    id: `dia7-${s.id}-${key}`,
    displayName: s.displayName,
    degreeLabel: s.degreeLabel,
    function: s.function,
    subLabel: triads[i].displayName,
    category: 'diatonic',
    isPro: false,
    rootOffset: s.rootOffset,
    suffix: s.suffix,
    definitionId: s.definitionId,
  }));
}

/* ------------------------------------------------------------------ */
/* Library: variations (apply to a chosen degree)                      */
/* ------------------------------------------------------------------ */

/**
 * Variation suffixes offered under the diatonic tab.
 *
 * Free: sus4 / add9 / sus2. Pro: 6th / 9 / 11 / 13.
 *
 * sus2 sits with sus4 rather than with the tensions: it is the same suspension
 * heard from the other side, it adds no note outside the triad's own scale, and a
 * player who can reach for one and not the other is being taught a rule that does
 * not exist.
 */
export const CHORD_VARIATIONS = [
  { id: 'sus4', label: 'sus4', suffix: 'sus4', isPro: false },
  { id: 'add9', label: 'add9', suffix: 'add9', isPro: false },
  { id: '6', label: '6th', suffix: '6', isPro: true },
  { id: 'sus2', label: 'sus2', suffix: 'sus2', isPro: false },
  { id: '9', label: '9', suffix: '9', isPro: true },
  { id: '11', label: '11', suffix: '11', isPro: true },
  { id: '13', label: '13', suffix: '13', isPro: true },
] as const;

/**
 * Richer colours offered behind a second tier, so the first row a beginner sees
 * stays the short familiar one. Same two rules as the core set: the degree keeps
 * its quality and every tone stays inside the key.
 *
 * Deliberately absent: `maj11` puts the ♮11 avoid note over a major 3rd, and
 * `m9(11)` / `m13(9)` spell exactly the same notes as the `11` and `13` already
 * offered on minor degrees. Tones that leave the key or sit a semitone above a
 * chord tone live one tier further down, in {@link ALTERED_VARIATIONS}.
 */
export const EXTENDED_VARIATIONS = [
  { id: 'sixNine', label: '6/9', suffix: '6/9', isPro: true },
  { id: 'maj9sharp11', label: 'maj9(#11)', suffix: 'maj9(#11)', isPro: true },
  { id: 'maj13sharp11', label: 'maj13(#11)', suffix: 'maj13(#11)', isPro: true },
  { id: 'm6nine', label: 'm6/9', suffix: 'm6/9', isPro: true },
  { id: 'm13_9_11', label: 'm13(9,11)', suffix: 'm13(9,11)', isPro: true },
  { id: 'm7b5_11', label: 'm7♭5(11)', suffix: 'm7♭5(11)', isPro: true },
  { id: 'm7b5_b13', label: 'm7♭5(♭13)', suffix: 'm7♭5(♭13)', isPro: true },
] as const;

/**
 * The altered tier — the tensions classic theory lists for each degree that the
 * other two tiers must refuse. Two kinds live here, and they are kept together
 * because both ask the player to hear a deliberate clash rather than a colour:
 *
 *  - Out of key: I's #11 (the Lydian F# in C) and V's ♭9/#9/#11/♭13.
 *  - In key but a semitone above a chord tone: iii's ♭9, vi's ♭13, vii°'s ♭9.
 *
 * Folded below the extended tier so the first two rows keep their guarantee that
 * every tone belongs to the key and never fights a chord tone.
 */
export const ALTERED_VARIATIONS = [
  { id: 'dom7b9', label: '♭9', suffix: '7(♭9)', isPro: true },
  { id: 'dom7sharp9', label: '#9', suffix: '7(#9)', isPro: true },
  { id: 'dom7sharp11', label: '#11', suffix: '7(#11)', isPro: true },
  { id: 'dom7b13', label: '♭13', suffix: '7(♭13)', isPro: true },
  { id: 'm7b9', label: '♭9', suffix: 'm7(♭9)', isPro: true },
  { id: 'm7b13', label: '♭13', suffix: 'm7(♭13)', isPro: true },
  { id: 'm7b5_b9', label: '♭9', suffix: 'm7♭5(♭9)', isPro: true },
] as const;

/** Every variation the editor can build, core tier first. */
export const ALL_VARIATIONS = [
  ...CHORD_VARIATIONS,
  ...EXTENDED_VARIATIONS,
  ...ALTERED_VARIATIONS,
] as const;

export type VariationId = (typeof ALL_VARIATIONS)[number]['id'];

/**
 * Diatonic-correct tension mapping. For each major-key degree (I..vi) it maps a
 * variation to the concrete chord-quality suffix that (a) respects the degree's
 * major/minor quality and (b) stays INSIDE the key — i.e. avoid-notes and
 * non-diatonic tensions are simply not offered for that degree. vii° (diminished)
 * takes no variations. Index = degree (0 = I … 5 = vi). Only listed variations are
 * available; the editor greys out / omits the rest.
 *
 * Reasoning per degree (in C for reference):
 *  I  (Ionian):     ♮11(F) is the avoid note → no 11; 9/13 voiced as maj9/maj13.
 *  ii (Dorian):     no avoid note → the full set (minor-quality forms).
 *  iii(Phrygian):   ♭9(F) & ♭13(C) are avoid → only sus4 & the 11 (add-11, no 9).
 *  IV (Lydian):     ♮4(B♭) is out of key → no sus4/11; 9/13 as maj9/maj13.
 *  V  (Mixolydian): ♮11(C) is the avoid note → no 11; 9/13 are dominant 9/13.
 *  vi (Aeolian):    ♮6(F#) is out of key → no 6/13; minor-quality forms.
 */
export const DEGREE_VARIATION_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: { sus4: 'sus4', sus2: 'sus2', add9: 'add9', '6': '6', '9': 'maj9', '13': 'maj13' },
  1: { sus4: 'sus4', sus2: 'sus2', add9: 'm(add9)', '6': 'm6', '9': 'm9', '11': 'm11', '13': 'm13' },
  2: { sus4: 'sus4', '11': 'm(add11)' },
  3: { sus2: 'sus2', add9: 'add9', '6': '6', '9': 'maj9', '13': 'maj13' },
  4: { sus4: 'sus4', sus2: 'sus2', add9: 'add9', '6': '6', '9': '9', '13': '13' },
  5: { sus4: 'sus4', sus2: 'sus2', add9: 'm(add9)', '9': 'm9', '11': 'm11' },
};

/**
 * Extended-tier suffixes per degree, filtered by the same rules as the core map.
 *
 * In C for reference: I and IV take 6/9; only Lydian IV can carry a #11 (B is in
 * key, whereas I would need an F#); Dorian ii is the one minor degree whose ♮6 and
 * ♮11 are both in key; vi's 6/9 would need an F#, and the ♮11 is already covered by
 * its core `11`. vii° gains its first two colours: the 11th and ♭13 are diatonic
 * over m7♭5, while the 9th would be the Locrian ♭2.
 *
 * Two degrees are left empty on purpose. V could spell a diatonic 6/9 (G B D E A),
 * but dropping the 7th throws away the dominant pull the degree exists for, and the
 * remaining notes are just its core `6` and `add9` stacked. iii is boxed in by its
 * ♭9 and ♭13, which rules out every extended form.
 */
const EXTENDED_DEGREE_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: { sixNine: '6/9' },
  1: { m6nine: 'm6/9', m13_9_11: 'm13(9,11)' },
  3: { sixNine: '6/9', maj9sharp11: 'maj9(#11)', maj13sharp11: 'maj13(#11)' },
  6: { m7b5_11: 'm7♭5(11)', m7b5_b13: 'm7♭5(♭13)' },
};

/**
 * Altered-tier suffixes per degree. This is the one map that is allowed to break
 * the in-key rule, so it lists each degree's tensions exactly as classic theory
 * does and no further:
 *
 *  I   → #11 (Lydian). ii and IV need nothing here: every tension they take is
 *        already in key, and IV's #11 is diatonic so it stays in the extended tier.
 *  iii → ♭9 (Phrygian). V → the four altered dominant tones. vi → ♭13 (Aeolian).
 *  vii°→ ♭9 (Locrian).
 */
const ALTERED_DEGREE_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = {
  0: { maj9sharp11: 'maj9(#11)', maj13sharp11: 'maj13(#11)' },
  2: { m7b9: 'm7(♭9)' },
  4: {
    dom7b9: '7(♭9)',
    dom7sharp9: '7(#9)',
    dom7sharp11: '7(#11)',
    dom7b13: '7(♭13)',
  },
  5: { m7b13: 'm7(♭13)' },
  6: { m7b5_b9: 'm7♭5(♭9)' },
};

/** Suffix map covering all three tiers — the single lookup `variationChord` resolves against. */
const ALL_DEGREE_SUFFIX: Record<number, Partial<Record<VariationId, string>>> = Object.fromEntries(
  Array.from({ length: 7 }, (_, degree) => [
    degree,
    {
      ...DEGREE_VARIATION_SUFFIX[degree],
      ...EXTENDED_DEGREE_SUFFIX[degree],
      ...ALTERED_DEGREE_SUFFIX[degree],
    },
  ]),
);

/**
 * Core-tier variations usable on the given degree, in button order — avoid-notes
 * and non-diatonic tensions removed. vii° (index 6) returns [].
 */
export function availableVariations(degreeIndex: number): VariationId[] {
  const map = DEGREE_VARIATION_SUFFIX[degreeIndex] ?? {};
  return CHORD_VARIATIONS.filter((v) => v.id in map).map((v) => v.id);
}

/**
 * Extended-tier variations usable on the given degree, in button order. Shown only
 * after the player opens the second tier, so the default row stays short.
 */
export function extendedVariations(degreeIndex: number): VariationId[] {
  const map = EXTENDED_DEGREE_SUFFIX[degreeIndex] ?? {};
  return EXTENDED_VARIATIONS.filter((v) => v.id in map).map((v) => v.id);
}

/**
 * Altered-tier variations usable on the given degree, in button order. Shares the
 * second tier's disclosure with {@link extendedVariations} but is listed after it
 * and under its own heading, because these are the tones that leave the key or
 * rub against a chord tone. Filtered over {@link ALL_VARIATIONS} rather than
 * {@link ALTERED_VARIATIONS} because I's #11 reuses the ids IV offers in key.
 */
export function alteredVariations(degreeIndex: number): VariationId[] {
  const map = ALTERED_DEGREE_SUFFIX[degreeIndex] ?? {};
  return ALL_VARIATIONS.filter((v) => v.id in map).map((v) => v.id);
}

/**
 * Build a variation chord on a diatonic degree, respecting the degree's quality
 * and the key (e.g. I + add9 → Cadd9, but vi + add9 → Am(add9), not Aadd9). If a
 * variation is not diatonic for the degree it falls back to the raw suffix, but
 * the editor only offers {@link availableVariations} so that path is unused in UI.
 */
export function variationChord(
  key: MajorKey,
  degreeIndex: number,
  variationId: VariationId,
): LibraryChord {
  const root = MAJOR_SCALES[key][degreeIndex];
  const v = ALL_VARIATIONS.find((x) => x.id === variationId) ?? ALL_VARIATIONS[0];
  const suffix = ALL_DEGREE_SUFFIX[degreeIndex]?.[variationId] ?? v.suffix;
  return {
    id: `var-${key}-${root}-${suffix}`,
    displayName: `${root}${suffix}`,
    degreeLabel: `${DEGREE_LABELS[degreeIndex]} ${v.label}`,
    function: DEGREE_FUNCTIONS[degreeIndex],
    subLabel: v.label,
    category: 'variation',
    variation: v.id,
    isPro: v.isPro,
    rootOffset: MAJOR_SCALE_OFFSETS[degreeIndex],
    suffix,
    definitionId: definitionIdForSuffix(suffix),
  };
}

/* ------------------------------------------------------------------ */
/* Library: secondary dominants (V7/ii … V7/vi)                        */
/* ------------------------------------------------------------------ */

const SECONDARY_TARGETS = [
  { degreeIndex: 1, degree: 'ii' },
  { degreeIndex: 2, degree: 'iii' },
  { degreeIndex: 3, degree: 'IV' },
  { degreeIndex: 4, degree: 'V' },
  { degreeIndex: 5, degree: 'vi' },
] as const;

/**
 * Secondary dominants for a key: the dominant-7th a fifth above each target
 * (V7/ii … V7/vi). Sub-label shows the chord they resolve to.
 */
export function secondaryDominants(key: MajorKey): LibraryChord[] {
  const scale = MAJOR_SCALES[key];
  const sevenths = diatonicSevenths(key);
  return SECONDARY_TARGETS.map((t) => {
    const domRootPc = NOTE_PC[scale[t.degreeIndex]] + 7; // a P5 above the target root
    const root = chromaticName(key, domRootPc);
    return {
      id: `secdom-${key}-${t.degree}`,
      displayName: `${root}7`,
      degreeLabel: `V7/${t.degree}`,
      function: 'dominant',
      subLabel: `→${sevenths[t.degreeIndex].displayName}`,
      category: 'secondaryDominant',
      isPro: true, // secondary dominants are Palette Pro (requirements §7)
      rootOffset: (MAJOR_SCALE_OFFSETS[t.degreeIndex] + 7) % 12,
      suffix: '7',
      definitionId: definitionIdForSuffix('7'),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Library: modal interchange (borrowed from parallel minor)           */
/* ------------------------------------------------------------------ */

const MODAL_CHORDS: {
  offset: number;
  degree: string;
  suffix: string;
  seventh: string;
  function: ChordFunction;
  pro?: boolean;
}[] = [
  { offset: 5, degree: 'IVm', suffix: 'm', seventh: 'm7', function: 'subdominant' },
  { offset: 7, degree: 'vm', suffix: 'm', seventh: 'm7', function: 'dominant' },
  { offset: 10, degree: '♭VII', suffix: '', seventh: '7', function: 'subdominant' },
  { offset: 8, degree: '♭VI', suffix: '', seventh: 'maj7', function: 'subdominant', pro: true },
  { offset: 3, degree: '♭III', suffix: '', seventh: 'maj7', function: 'tonic', pro: true },
];

/** Modal-interchange chords borrowed from the parallel minor. */
export function modalInterchange(key: MajorKey): LibraryChord[] {
  return MODAL_CHORDS.map((m) => {
    const root = noteAt(key, m.offset);
    return {
      id: `modal-${key}-${m.degree}`,
      displayName: `${root}${m.suffix}`,
      degreeLabel: m.degree,
      function: m.function,
      subLabel: `${root}${m.seventh}`,
      category: 'modalInterchange',
      isPro: true, // borrowed / modal-interchange chords are Palette Pro (requirements §7)
      rootOffset: m.offset,
      suffix: m.suffix,
      definitionId: definitionIdForSuffix(m.suffix),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Library: slash / on-chords (target chord + bass note)               */
/* ------------------------------------------------------------------ */

/** The 12 chromatic bass notes offered in the on-chord grid, spelled for the key. */
export function chromaticBassNotes(key: MajorKey): string[] {
  const table = SHARP_KEYS.includes(key) ? SHARP_NAMES : FLAT_NAMES;
  return [...table];
}

/** Combine a target chord with a bass note → slash chord (e.g. C + E → C/E). */
export function slashChord(key: MajorKey, target: LibraryChord, bass: string): LibraryChord {
  const bassOffset = offsetFromTonic(key, bass);
  return {
    id: `slash-${key}-${target.id}-${bass}`,
    // Name stays alphabetic (e.g. "C/E"); the degree label puts the bass as a
    // *degree* in the denominator (e.g. "I/III") so it reads harmonically and is
    // key-invariant.
    displayName: `${target.displayName}/${bass}`,
    degreeLabel: `${target.degreeLabel}/${degreeLabelFromOffset(bassOffset)}`,
    function: target.function,
    subLabel: `bass ${bass}`,
    category: 'slash',
    bassNote: bass,
    isPro: true, // slash / on-chords are Palette Pro (requirements §7)
    rootOffset: target.rootOffset,
    suffix: target.suffix,
    definitionId: target.definitionId,
    bassOffset,
  };
}
