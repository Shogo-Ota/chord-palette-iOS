import { getDefinitionBySymbol } from '@/lib/music/definitions/catalog';
import {
  CHORD_VARIATIONS,
  availableVariations,
  variationMeta,
  variationSuffix,
  type VariationId,
} from '@/lib/music/variations';
import type { ChordFunction, DiatonicChord, LibraryChord, MajorKey } from '@/types';

export { CHORD_VARIATIONS, availableVariations };
export type { VariationId };

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
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] as const;

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
const TRIAD_SUFFIXES = ['', 'm', 'm', '', '', 'm', 'dim'] as const;

function definitionIdForSuffix(suffix: string): string | undefined {
  return getDefinitionBySymbol(suffix)?.id;
}

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
    definitionId: definitionIdForSuffix(t.suffix),
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
    definitionId: definitionIdForSuffix(s.suffix),
  }));
}

/* ------------------------------------------------------------------ */
/* Library: variations (apply to a chosen degree)                      */
/* ------------------------------------------------------------------ */

/**
 * Build a variation chord on a diatonic degree.
 * Catalog + degree maps live in `@/lib/music` (Phase 5: avoid-notes do not restrict).
 */
export function variationChord(
  key: MajorKey,
  degreeIndex: number,
  variationId: VariationId,
): LibraryChord {
  const root = MAJOR_SCALES[key][degreeIndex];
  const v = variationMeta(variationId);
  const suffix = variationSuffix(degreeIndex, variationId);
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
  return {
    id: `slash-${key}-${target.id}-${bass}`,
    displayName: `${target.displayName}/${bass}`,
    degreeLabel: `${target.degreeLabel}/${bass}`,
    function: target.function,
    subLabel: `bass ${bass}`,
    category: 'slash',
    bassNote: bass,
    isPro: true, // slash / on-chords are Palette Pro (requirements §7)
    rootOffset: target.rootOffset,
    suffix: target.suffix,
    definitionId: target.definitionId ?? definitionIdForSuffix(target.suffix),
    bassOffset: offsetFromTonic(key, bass),
  };
}
