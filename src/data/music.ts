import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { ChordFunction, DiatonicChord, KeyMode, LibraryChord, MajorKey } from '@/types';

import {
  MINOR_DEGREE_FUNCTIONS,
  MINOR_DEGREE_LABELS,
  MINOR_SCALE_OFFSETS,
  MINOR_SCALES,
  MINOR_SEVENTH_SUFFIXES,
  MINOR_SHARP_KEYS,
  MINOR_TRIAD_SUFFIXES,
  minorDegreeIndexFromRootOffset,
  minorTonicName,
} from './minorMode';

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

/**
 * Diatonic degree index (major: 0 = I … 6 = vii°; minor: 0 = i … 6 = ♭VII) for a root
 * offset, or -1 if non-diatonic.
 */
export function degreeIndexFromRootOffset(rootOffset: number, mode: KeyMode = 'major'): number {
  if (mode === 'minor') return minorDegreeIndexFromRootOffset(rootOffset);
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

/** The seven scale steps of `key` in `mode`, with the tables that describe them. */
function degreeTables(key: MajorKey, mode: KeyMode) {
  const minor = mode === 'minor';
  return {
    scale: (minor ? MINOR_SCALES[key] : MAJOR_SCALES[key]) as readonly string[],
    labels: (minor ? MINOR_DEGREE_LABELS : DEGREE_LABELS) as readonly string[],
    functions: (minor ? MINOR_DEGREE_FUNCTIONS : DEGREE_FUNCTIONS) as readonly ChordFunction[],
    offsets: (minor ? MINOR_SCALE_OFFSETS : MAJOR_SCALE_OFFSETS) as readonly number[],
  };
}

function build(key: MajorKey, suffixes: readonly string[], mode: KeyMode): DiatonicChord[] {
  const { scale, labels, functions, offsets } = degreeTables(key, mode);
  return scale.map((root, i) => {
    const displayName = `${root}${suffixes[i]}`;
    return {
      id: displayName,
      displayName,
      degreeLabel: labels[i],
      function: functions[i],
      rootOffset: offsets[i],
      suffix: suffixes[i],
      definitionId: definitionIdForSuffix(suffixes[i]),
    };
  });
}

/**
 * Diatonic seventh chords for the given key (C major → Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5;
 * A minor → Am7 Bm7♭5 Cmaj7 Dm7 Em7 Fmaj7 G7).
 */
export function diatonicSevenths(key: MajorKey, mode: KeyMode = 'major'): DiatonicChord[] {
  return build(key, mode === 'minor' ? MINOR_SEVENTH_SUFFIXES : SEVENTH_SUFFIXES, mode);
}

/** Diatonic triads for the given key (C major → C Dm Em F G Am Bdim; A minor → Am Bdim C Dm Em F G). */
export function diatonicTriads(key: MajorKey, mode: KeyMode = 'major'): DiatonicChord[] {
  return build(key, mode === 'minor' ? MINOR_TRIAD_SUFFIXES : TRIAD_SUFFIXES, mode);
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

function chromaticName(key: MajorKey, pc: number, mode: KeyMode = 'major'): string {
  const sharp = mode === 'minor' ? MINOR_SHARP_KEYS.includes(key) : SHARP_KEYS.includes(key);
  return (sharp ? SHARP_NAMES : FLAT_NAMES)[((pc % 12) + 12) % 12];
}

/**
 * Pitch class of the key's tonic. Mode-independent: a minor respelling changes the
 * letters but not the pitch (`A♭` major and `G#` minor are both pitch class 8), which
 * is why switching mode cannot move a single note of the accompaniment.
 */
function tonicPc(key: MajorKey): number {
  return NOTE_PC[MAJOR_SCALES[key][0]];
}

/** Pitch class (0 = C) of the key's tonic — used by audio voicing to build MIDI notes. */
export function keyTonicPc(key: MajorKey): number {
  return tonicPc(key);
}

/**
 * How the tonic is written for display. Same pitch either way; a minor tonic is
 * respelled where the flat name would need double flats (D♭ minor → C♯ minor).
 */
export function keyDisplayName(key: MajorKey, mode: KeyMode = 'major'): string {
  return mode === 'minor' ? minorTonicName(key) : key;
}

/** The key as every screen writes it, e.g. `C Major` / `C# Minor`. */
export function keyLabel(key: MajorKey, mode: KeyMode = 'major'): string {
  return `${keyDisplayName(key, mode)} ${mode === 'minor' ? 'Minor' : 'Major'}`;
}

/** Note name `offset` semitones above the tonic, spelled for the key. */
export function noteAt(key: MajorKey, offset: number, mode: KeyMode = 'major'): string {
  return chromaticName(key, tonicPc(key) + offset, mode);
}

/**
 * Spell an altered scale degree by its musical letter, not only its pitch class.
 * This distinguishes direction-sensitive names such as #I (C#) from bII (Db).
 * Double accidentals fall back to the app's simpler chromatic spelling.
 */
export function noteAtDegree(
  key: MajorKey,
  degreeIndex: number,
  alteration: -1 | 0 | 1,
  mode: KeyMode = 'major',
): string {
  const { scale, offsets } = degreeTables(key, mode);
  const base = scale[degreeIndex];
  const offset = offsets[degreeIndex];
  if (base == null || offset == null) return noteAt(key, alteration, mode);
  if (alteration === 0) return base;

  const match = /^([A-G])([#♭]?)$/.exec(base);
  if (!match) return noteAt(key, offset + alteration, mode);
  const current = match[2] === '#' ? 1 : match[2] === '♭' ? -1 : 0;
  const next = current + alteration;
  if (Math.abs(next) > 1) return noteAt(key, offset + alteration, mode);
  return `${match[1]}${next === 1 ? '#' : next === -1 ? '♭' : ''}`;
}

/** Note name (no octave) of a MIDI note, spelled for the key. Used by the keyboard visual. */
export function midiNoteName(key: MajorKey, midi: number, mode: KeyMode = 'major'): string {
  return chromaticName(key, midi, mode);
}

/** Semitones a spelled note sits above the key's tonic (0..11). */
export function offsetFromTonic(key: MajorKey, note: string): number {
  return ((((NOTE_PC[note] ?? 0) - tonicPc(key)) % 12) + 12) % 12;
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
export function rootDegreeLabel(offset: number, mode: KeyMode = 'major'): string {
  const idx = degreeIndexFromRootOffset(offset, mode);
  if (idx < 0) return degreeLabelFromOffset(offset);
  return mode === 'minor' ? MINOR_DEGREE_LABELS[idx] : DEGREE_LABELS[idx];
}

/* ------------------------------------------------------------------ */
/* Library: diatonic (triad main + 7th pill)                           */
/* ------------------------------------------------------------------ */

/**
 * Diatonic library cards for a key: big name = triad (C, Dm…),
 * sub-label = the diatonic seventh (Cmaj7, Dm7…).
 */
export function diatonicLibrary(key: MajorKey, mode: KeyMode = 'major'): LibraryChord[] {
  const triads = diatonicTriads(key, mode);
  const sevenths = diatonicSevenths(key, mode);
  return triads.map((t, i) => ({
    id: `dia-${t.id}-${key}-${mode}`,
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
export function diatonicSeventhLibrary(key: MajorKey, mode: KeyMode = 'major'): LibraryChord[] {
  const triads = diatonicTriads(key, mode);
  const sevenths = diatonicSevenths(key, mode);
  return sevenths.map((s, i) => ({
    id: `dia7-${s.id}-${key}-${mode}`,
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
 * Every variation the editor can build, and the one place its price is decided.
 *
 * This is a registry, not an offer: it says a variation exists and whether it is
 * free, and nothing about which degree may wear it. `label` and `suffix` here are
 * only the fallback for a degree that does not name its own — the real caption and
 * quality come from the degree table, because the same id reads as `maj9` on I and
 * `m9` on ii.
 *
 * Free: sus4 / add9 (requirements §7), plus the plain `m7♭5`, which the seventh
 * grid already hands out for free on vii°.
 */
export const ALL_VARIATIONS = [
  { id: 'sus2', label: 'sus2', suffix: 'sus2', isPro: true },
  { id: 'sus4', label: 'sus4', suffix: 'sus4', isPro: false },
  { id: 'add9', label: 'add9', suffix: 'add9', isPro: false },
  { id: '6', label: '6', suffix: '6', isPro: true },
  { id: 'sixNine', label: '6/9', suffix: '6/9', isPro: true },
  { id: '9', label: '9', suffix: '9', isPro: true },
  { id: '11', label: '11', suffix: '11', isPro: true },
  { id: '13', label: '13', suffix: '13', isPro: true },
  { id: 'm6nine', label: 'm6/9', suffix: 'm6/9', isPro: true },
  { id: 'm13_9_11', label: 'm13(9,11)', suffix: 'm13(9,11)', isPro: true },
  { id: 'm7_add11', label: 'm7(add11)', suffix: 'm7(add11)', isPro: true },
  { id: 'maj7sharp11', label: 'maj7(#11)', suffix: 'maj7(#11)', isPro: true },
  { id: 'maj9sharp11', label: 'maj9(#11)', suffix: 'maj9(#11)', isPro: true },
  { id: 'maj13sharp11', label: 'maj13(#11)', suffix: 'maj13(#11)', isPro: true },
  { id: 'dom7b9', label: '♭9', suffix: '7(♭9)', isPro: true },
  { id: 'dom7sharp9', label: '#9', suffix: '7(#9)', isPro: true },
  { id: 'dom7sharp11', label: '#11', suffix: '7(#11)', isPro: true },
  { id: 'dom7b13', label: '♭13', suffix: '7(♭13)', isPro: true },
  { id: 'm7b9', label: 'm7(♭9)', suffix: 'm7(♭9)', isPro: true },
  { id: 'm7b13', label: 'm7(♭13)', suffix: 'm7(♭13)', isPro: true },
  { id: 'm7b5', label: 'm7♭5', suffix: 'm7♭5', isPro: false },
  { id: 'm7b5_11', label: 'm7♭5(11)', suffix: 'm7♭5(11)', isPro: true },
  { id: 'm7b5_b9', label: 'm7♭5(♭9)', suffix: 'm7♭5(♭9)', isPro: true },
  { id: 'm7b5_b13', label: 'm7♭5(♭13)', suffix: 'm7♭5(♭13)', isPro: true },
  { id: 'dim7', label: 'dim7', suffix: 'dim7', isPro: true },
] as const;

export type VariationId = (typeof ALL_VARIATIONS)[number]['id'];

/**
 * Where a variation sits in the offer, and therefore which row shows it.
 *
 * `primary` is the always-visible row: reach for these without thinking.
 * `secondary` is the same promise with more colour, folded away.
 * `advanced` is the 強い色づけ row — a deliberate character, not a safe default.
 */
export type VariationUsability = 'primary' | 'secondary' | 'advanced';

/**
 * What kind of colour a variation adds. The player never sees these names; they
 * exist so a later context-aware ranker can tell a Lydian #11 apart from an
 * altered dominant ♭9 instead of lumping both under "outside the scale".
 */
export type VariationColorClass =
  | 'standard'
  | 'lydian'
  | 'minorColor'
  | 'alteredDominant'
  | 'diminishedColor';

/** One variation as a specific degree offers it. */
export interface DegreeVariation {
  id: VariationId;
  /**
   * Pill caption. Reads as the quality it actually produces on this degree, so
   * `Dm9` is captioned `m9` and `G9` is captioned `9`.
   */
  label: string;
  /** Quality suffix appended to the degree root: `m9` on ii spells `Dm9`. */
  suffix: string;
  usability: VariationUsability;
  colorClass: VariationColorClass;
  /** Whether every sounding tone belongs to the current key. */
  scaleCompatibility: 'inside' | 'outside' | 'mixed';
  /**
   * How much the result leans on voicing to sound good. `high` means it contains a
   * semitone rub that a bad voicing will expose — legal, but not a safe default.
   */
  dissonanceLevel: 'low' | 'medium' | 'high';
  /** The tension this adds, for a future ranker to reason about. */
  tensionClass?: string;
}

/**
 * A degree variation, defaulting to the common case: inside the key, no character
 * beyond the extension itself, and forgiving of voicing.
 */
export function variationOffer(
  id: VariationId,
  label: string,
  suffix: string,
  usability: VariationUsability,
  colour: Partial<Omit<DegreeVariation, 'id' | 'label' | 'suffix' | 'usability'>> = {},
): DegreeVariation {
  return {
    id,
    label,
    suffix,
    usability,
    colorClass: 'standard',
    scaleCompatibility: 'inside',
    dissonanceLevel: 'low',
    ...colour,
  };
}

/** The Lydian #11 — in key on IV, out of key on I. */
const LYDIAN = {
  colorClass: 'lydian',
  dissonanceLevel: 'medium',
  tensionClass: '#11',
} as const;

/** V's altered tensions: outside the key, and that is the point. */
const ALTERED_DOMINANT = {
  colorClass: 'alteredDominant',
  scaleCompatibility: 'outside',
  dissonanceLevel: 'high',
} as const;

/**
 * What each major-key degree offers, in the order the editor shows it.
 *
 * The list is not the set of chords theory permits — it is the set worth reaching
 * for. A degree gets as many entries as it can carry usefully and no more, so ii
 * is long and iii is short. Ordering runs sus/add → 6 → 9 → 11 → 13 → 強い色づけ,
 * which is also the order of increasing commitment.
 *
 * Reasoning per degree (in C for reference):
 *  I  (Ionian):     ♮11(F) is the avoid note → no 11. `maj13` is dropped: against
 *                   the `maj9` beside it the difference is small and it needs the
 *                   right voicing to show at all.
 *  ii (Dorian):     no avoid note, so the whole ladder up to `m13` works. `m13` is
 *                   spelled plainly rather than as `m13(9,11)`, which named the
 *                   same notes twice.
 *  iii(Phrygian):   ♭9(F) and ♭13(C) both rub. `m7(♭9)` is gone — the E–F semitone
 *                   is the single easiest way to pick a chord by accident. The ♭13
 *                   stays, under 強い色づけ.
 *  IV (Lydian):     ♮4(B♭) leaves the key → no sus4/11. The #11 is diatonic here,
 *                   so the whole Lydian family is welcome.
 *  V  (Mixolydian): ♮11(C) is the avoid note → no 11. The four altered tensions
 *                   belong to the dominant function, so they stay.
 *  vi (Aeolian):    ♮6(F#) leaves the key → no 6/13.
 *  vii°(Locrian):   the plain `m7♭5` comes first so the degree is reachable at all,
 *                   and `dim7` earns its place on how clearly it resolves to I.
 *                   `m7♭5(♭9)` is gone for the same reason as iii's — B–C rubs.
 */
const MAJOR_DEGREE_VARIATIONS: readonly (readonly DegreeVariation[])[] = [
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'add9', 'primary', { tensionClass: '9' }),
    variationOffer('6', '6', '6', 'primary', { tensionClass: '6' }),
    variationOffer('sixNine', '6/9', '6/9', 'secondary', { tensionClass: '6/9' }),
    variationOffer('9', 'maj9', 'maj9', 'secondary', { tensionClass: '9' }),
    variationOffer('maj7sharp11', 'maj7(#11)', 'maj7(#11)', 'advanced', {
      ...LYDIAN,
      scaleCompatibility: 'outside',
    }),
    variationOffer('maj9sharp11', 'maj9(#11)', 'maj9(#11)', 'advanced', {
      ...LYDIAN,
      scaleCompatibility: 'outside',
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
  ],
  [
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('11', 'm(add11)', 'm(add11)', 'primary', { tensionClass: '11' }),
    variationOffer('m7_add11', 'm7(add11)', 'm7(add11)', 'secondary', { tensionClass: '11' }),
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
    variationOffer('maj7sharp11', 'maj7(#11)', 'maj7(#11)', 'advanced', LYDIAN),
    variationOffer('maj9sharp11', 'maj9(#11)', 'maj9(#11)', 'advanced', LYDIAN),
    variationOffer('maj13sharp11', 'maj13(#11)', 'maj13(#11)', 'advanced', LYDIAN),
  ],
  [
    variationOffer('sus2', 'sus2', 'sus2', 'primary'),
    variationOffer('sus4', 'sus4', 'sus4', 'primary'),
    variationOffer('add9', 'add9', 'add9', 'primary', { tensionClass: '9' }),
    variationOffer('6', '6', '6', 'primary', { tensionClass: '6' }),
    variationOffer('9', '9', '9', 'secondary', { tensionClass: '9' }),
    variationOffer('13', '13', '13', 'secondary', {
      dissonanceLevel: 'medium',
      tensionClass: '13',
    }),
    variationOffer('dom7b9', '♭9', '7(♭9)', 'advanced', { ...ALTERED_DOMINANT, tensionClass: 'b9' }),
    variationOffer('dom7sharp9', '#9', '7(#9)', 'advanced', { ...ALTERED_DOMINANT, tensionClass: '#9' }),
    variationOffer('dom7sharp11', '#11', '7(#11)', 'advanced', { ...ALTERED_DOMINANT, tensionClass: '#11' }),
    variationOffer('dom7b13', '♭13', '7(♭13)', 'advanced', { ...ALTERED_DOMINANT, tensionClass: 'b13' }),
  ],
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
    variationOffer('m7b5', 'm7♭5', 'm7♭5', 'primary'),
    variationOffer('m7b5_11', 'm7♭5(11)', 'm7♭5(11)', 'secondary', { tensionClass: '11' }),
    variationOffer('dim7', 'dim7', 'dim7', 'secondary', {
      colorClass: 'diminishedColor',
      scaleCompatibility: 'outside',
      dissonanceLevel: 'medium',
    }),
    variationOffer('m7b5_b13', 'm7♭5(♭13)', 'm7♭5(♭13)', 'advanced', {
      colorClass: 'diminishedColor',
      dissonanceLevel: 'medium',
      tensionClass: 'b13',
    }),
  ],
];

/** What the given major-key degree offers, in display order. */
export function degreeVariations(degreeIndex: number): readonly DegreeVariation[] {
  return MAJOR_DEGREE_VARIATIONS[degreeIndex] ?? [];
}

/** Ids the given degree offers at one usability level, in display order. */
export function variationsByUsability(
  degreeIndex: number,
  usability: VariationUsability,
): VariationId[] {
  return degreeVariations(degreeIndex)
    .filter((entry) => entry.usability === usability)
    .map((entry) => entry.id);
}

/** The always-visible row for the given degree. */
export function availableVariations(degreeIndex: number): VariationId[] {
  return variationsByUsability(degreeIndex, 'primary');
}

/** The folded row of richer but still safe colours. */
export function extendedVariations(degreeIndex: number): VariationId[] {
  return variationsByUsability(degreeIndex, 'secondary');
}

/** The 強い色づけ row — deliberate character rather than a safe default. */
export function strongVariations(degreeIndex: number): VariationId[] {
  return variationsByUsability(degreeIndex, 'advanced');
}

/**
 * Build a variation chord on a diatonic degree, respecting the degree's quality
 * and the key (e.g. I + add9 → Cadd9, but vi + add9 → Am(add9), not Aadd9). A
 * variation the degree does not offer falls back to the registry's plain form; the
 * editor only ever offers what {@link degreeVariations} lists, so that path exists
 * for projects saved before this degree stopped offering the variation.
 */
export function variationChord(
  key: MajorKey,
  degreeIndex: number,
  variationId: VariationId,
): LibraryChord {
  const root = MAJOR_SCALES[key][degreeIndex];
  const registry = ALL_VARIATIONS.find((x) => x.id === variationId) ?? ALL_VARIATIONS[0];
  const entry = degreeVariations(degreeIndex).find((x) => x.id === variationId);
  const suffix = entry?.suffix ?? registry.suffix;
  const label = entry?.label ?? registry.label;
  return {
    id: `var-${key}-${root}-${suffix}`,
    displayName: `${root}${suffix}`,
    degreeLabel: `${DEGREE_LABELS[degreeIndex]} ${label}`,
    function: DEGREE_FUNCTIONS[degreeIndex],
    subLabel: label,
    category: 'variation',
    variation: registry.id,
    isPro: registry.isPro,
    rootOffset: MAJOR_SCALE_OFFSETS[degreeIndex],
    suffix,
    definitionId: definitionIdForSuffix(suffix),
  };
}

/* ------------------------------------------------------------------ */
/* Library: secondary dominants (displayed as VI7 … III7)              */
/* ------------------------------------------------------------------ */

const SECONDARY_TARGETS = [
  { degreeIndex: 1, degree: 'ii', dominantDegree: 'VI7' },
  { degreeIndex: 2, degree: 'iii', dominantDegree: 'VII7' },
  { degreeIndex: 3, degree: 'IV', dominantDegree: 'I7' },
  { degreeIndex: 4, degree: 'V', dominantDegree: 'II7' },
  { degreeIndex: 5, degree: 'vi', dominantDegree: 'III7' },
] as const;

/**
 * Secondary dominants for a key: the dominant-7th a fifth above each target
 * (functionally V7/ii … V7/vi). The main label uses the simpler root degree
 * (VI7 … III7); the sub-label preserves the resolution destination.
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
      degreeLabel: t.dominantDegree,
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
export function chromaticBassNotes(key: MajorKey, mode: KeyMode = 'major'): string[] {
  const sharp = mode === 'minor' ? MINOR_SHARP_KEYS.includes(key) : SHARP_KEYS.includes(key);
  return [...(sharp ? SHARP_NAMES : FLAT_NAMES)];
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
