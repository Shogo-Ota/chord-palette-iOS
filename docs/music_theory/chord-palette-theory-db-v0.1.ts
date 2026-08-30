/**
 * Chord Palette Theory Database v0.1
 *
 * Source basis:
 * 養父 貴『ギターで覚える音楽理論』
 *
 * Purpose:
 * - Convert the source book into deterministic, root-relative rules usable by Chord Palette.
 * - Keep source-derived theory separate from Chord Palette-specific implementation policy.
 * - Do NOT modify PerformanceEngine / Energy profiles by importing this file alone.
 *
 * Provenance:
 * - BOOK_EXPLICIT: stated directly in text / summary table.
 * - BOOK_DIAGRAM: derived from a diagram/table in the book.
 * - APP_POLICY_PROPOSED: Chord Palette design choice; not asserted by the book.
 */

export type ProvenanceKind =
  | 'BOOK_EXPLICIT'
  | 'BOOK_DIAGRAM'
  | 'APP_POLICY_PROPOSED';

export interface SourceRef {
  kind: ProvenanceKind;
  printedPages: number[];
  chapter: string;
  note?: string;
}

export type DegreeToken =
  | 'R'
  | 'b2' | '2' | '#2'
  | 'b3' | '3'
  | 'b4' | '4' | '#4'
  | 'b5' | '5' | '#5'
  | 'b6' | '6' | '#6'
  | 'bb7' | 'b7' | '7';

export const DEGREE_TO_SEMITONE: Record<DegreeToken, number> = {
  R: 0,
  b2: 1, 2: 2, '#2': 3,
  b3: 3, 3: 4,
  b4: 4, 4: 5, '#4': 6,
  b5: 6, 5: 7, '#5': 8,
  b6: 8, 6: 9, '#6': 10,
  bb7: 9, b7: 10, 7: 11,
};

export type TensionToken =
  | 'b9' | '9' | '#9'
  | '11' | '#11'
  | 'b13' | '13';

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | '7'
  | 'min7'
  | 'minMaj7'
  | 'min7b5'
  | 'dim7'
  | 'maj6'
  | 'min6'
  | 'sus4'
  | '7sus4'
  | 'add9'
  | 'minAdd9';

export interface ChordFormula {
  quality: ChordQuality;
  degrees: DegreeToken[];
  essentialDegrees: DegreeToken[];
  normallyOmittableDegrees: DegreeToken[];
  alteredFifthMustBeRetained?: boolean;
  source: SourceRef[];
}

export const CHORD_FORMULAS: Record<ChordQuality, ChordFormula> = {
  maj: {
    quality: 'maj',
    degrees: ['R', '3', '5'],
    essentialDegrees: ['R', '3'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [23, 26], chapter: 'Part 2 / ダイアトニック・コード' }],
  },
  min: {
    quality: 'min',
    degrees: ['R', 'b3', '5'],
    essentialDegrees: ['R', 'b3'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [23, 26], chapter: 'Part 2 / ダイアトニック・コード' }],
  },
  dim: {
    quality: 'dim',
    degrees: ['R', 'b3', 'b5'],
    essentialDegrees: ['R', 'b3', 'b5'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [22, 145], chapter: 'Part 2 / Part 3 ディミニッシュ' }],
  },
  aug: {
    quality: 'aug',
    degrees: ['R', '3', '#5'],
    essentialDegrees: ['R', '3', '#5'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [86, 87], chapter: 'Part 2 / マイナー・ダイアトニック' }],
  },
  maj7: {
    quality: 'maj7',
    degrees: ['R', '3', '5', '7'],
    essentialDegrees: ['3', '7'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [24, 228, 229], chapter: 'Part 2 / Part 4 実践的ボイシング' },
    ],
  },
  7: {
    quality: '7',
    degrees: ['R', '3', '5', 'b7'],
    essentialDegrees: ['3', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [24, 29, 228, 229], chapter: 'Part 2 / Part 4 実践的ボイシング' },
    ],
  },
  min7: {
    quality: 'min7',
    degrees: ['R', 'b3', '5', 'b7'],
    essentialDegrees: ['b3', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [24, 228, 229], chapter: 'Part 2 / Part 4 実践的ボイシング' },
    ],
  },
  minMaj7: {
    quality: 'minMaj7',
    degrees: ['R', 'b3', '5', '7'],
    essentialDegrees: ['b3', '7'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [86, 87], chapter: 'Part 2 / マイナー・ダイアトニック' }],
  },
  min7b5: {
    quality: 'min7b5',
    degrees: ['R', 'b3', 'b5', 'b7'],
    essentialDegrees: ['b3', 'b5', 'b7'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [24, 65, 228], chapter: 'Part 2 / Part 4 実践的ボイシング' },
    ],
  },
  dim7: {
    quality: 'dim7',
    degrees: ['R', 'b3', 'b5', 'bb7'],
    essentialDegrees: ['R', 'b3', 'b5', 'bb7'],
    normallyOmittableDegrees: [],
    alteredFifthMustBeRetained: true,
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [145, 146, 147, 148, 149], chapter: 'Part 3 / ディミニッシュ・コード' }],
  },
  maj6: {
    quality: 'maj6',
    degrees: ['R', '3', '5', '6'],
    essentialDegrees: ['R', '3', '6'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [94, 95, 96, 97], chapter: 'Part 3 / 6thコード' }],
  },
  min6: {
    quality: 'min6',
    degrees: ['R', 'b3', '5', '6'],
    essentialDegrees: ['R', 'b3', '6'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [101, 102, 103], chapter: 'Part 3 / m6thコード' }],
  },
  sus4: {
    quality: 'sus4',
    degrees: ['R', '4', '5'],
    essentialDegrees: ['R', '4'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [104, 105, 106], chapter: 'Part 3 / sus4コード' }],
  },
  '7sus4': {
    quality: '7sus4',
    degrees: ['R', '4', '5', 'b7'],
    essentialDegrees: ['4', 'b7'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [107, 108], chapter: 'Part 3 / sus4コード' }],
  },
  add9: {
    quality: 'add9',
    degrees: ['R', '3', '5', '2'],
    essentialDegrees: ['R', '3', '2'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [109, 110, 111, 112], chapter: 'Part 3 / addコード' }],
  },
  minAdd9: {
    quality: 'minAdd9',
    degrees: ['R', 'b3', '5', '2'],
    essentialDegrees: ['R', 'b3', '2'],
    normallyOmittableDegrees: ['5'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [109, 110, 111, 112], chapter: 'Part 3 / addコード' }],
  },
};

export interface ScaleFormula {
  id: string;
  degrees: DegreeToken[];
  source: SourceRef[];
}

export const SCALE_FORMULAS: Record<string, ScaleFormula> = {
  ionian: {
    id: 'ionian',
    degrees: ['R', '2', '3', '4', '5', '6', '7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [40, 41], chapter: 'Part 2 / コード・スケール1' }],
  },
  dorian: {
    id: 'dorian',
    degrees: ['R', '2', 'b3', '4', '5', '6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [40, 41], chapter: 'Part 2 / コード・スケール1' }],
  },
  phrygian: {
    id: 'phrygian',
    degrees: ['R', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [41], chapter: 'Part 2 / コード・スケール1' }],
  },
  lydian: {
    id: 'lydian',
    degrees: ['R', '2', '3', '#4', '5', '6', '7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [41], chapter: 'Part 2 / コード・スケール1' }],
  },
  mixolydian: {
    id: 'mixolydian',
    degrees: ['R', '2', '3', '4', '5', '6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [41], chapter: 'Part 2 / コード・スケール1' }],
  },
  aeolian: {
    id: 'aeolian',
    degrees: ['R', '2', 'b3', '4', '5', 'b6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [41, 57, 58], chapter: 'Part 2 / コード・スケール1 / マイナー' }],
  },
  locrian: {
    id: 'locrian',
    degrees: ['R', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [41], chapter: 'Part 2 / コード・スケール1' }],
  },
  harmonicMinor: {
    id: 'harmonicMinor',
    degrees: ['R', '2', 'b3', '4', '5', 'b6', '7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [64, 65, 73, 76], chapter: 'Part 2 / ハーモニック・マイナー' }],
  },
  melodicMinor: {
    id: 'melodicMinor',
    degrees: ['R', '2', 'b3', '4', '5', '6', '7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [69, 70, 80], chapter: 'Part 2 / メロディック・マイナー' }],
  },
  lydianDominant: {
    id: 'lydianDominant',
    degrees: ['R', '2', '3', '#4', '5', '6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [81, 124, 127, 136, 137, 138], chapter: 'Part 2 / Part 3 代理ドミナント' }],
  },
  altered: {
    id: 'altered',
    degrees: ['R', 'b2', '#2', '3', 'b5', 'b6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [81, 82, 90], chapter: 'Part 2 / オルタード・スケール' }],
  },
  wholeTone: {
    id: 'wholeTone',
    degrees: ['R', '2', '3', 'b5', 'b6', 'b7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [90], chapter: 'Part 2 / V7で使える変化系スケール' }],
  },
};

export type HarmonicFunction = 'TONIC' | 'SUBDOMINANT' | 'DOMINANT';

export interface DiatonicDegreeRule {
  degree: string;
  rootOffset: number;
  triad: ChordQuality;
  seventh: ChordQuality;
  function?: HarmonicFunction;
  chordScale?: string;
}

export const MAJOR_DIATONIC: DiatonicDegreeRule[] = [
  { degree: 'I', rootOffset: 0, triad: 'maj', seventh: 'maj7', function: 'TONIC', chordScale: 'ionian' },
  { degree: 'ii', rootOffset: 2, triad: 'min', seventh: 'min7', function: 'SUBDOMINANT', chordScale: 'dorian' },
  { degree: 'iii', rootOffset: 4, triad: 'min', seventh: 'min7', function: 'TONIC', chordScale: 'phrygian' },
  { degree: 'IV', rootOffset: 5, triad: 'maj', seventh: 'maj7', function: 'SUBDOMINANT', chordScale: 'lydian' },
  { degree: 'V', rootOffset: 7, triad: 'maj', seventh: '7', function: 'DOMINANT', chordScale: 'mixolydian' },
  { degree: 'vi', rootOffset: 9, triad: 'min', seventh: 'min7', function: 'TONIC', chordScale: 'aeolian' },
  { degree: 'viiø', rootOffset: 11, triad: 'dim', seventh: 'min7b5', function: 'DOMINANT', chordScale: 'locrian' },
];

export const MAJOR_DIATONIC_SOURCE: SourceRef[] = [
  { kind: 'BOOK_EXPLICIT', printedPages: [22, 23, 24, 25, 26], chapter: 'Part 2 / ダイアトニック・コード' },
  { kind: 'BOOK_EXPLICIT', printedPages: [28, 29, 30, 31, 32, 33, 34, 35, 36], chapter: 'Part 2 / メジャー・ダイアトニックのコード進行' },
  { kind: 'BOOK_EXPLICIT', printedPages: [40, 41], chapter: 'Part 2 / コード・スケール1' },
];

export const NATURAL_MINOR_DIATONIC: DiatonicDegreeRule[] = [
  { degree: 'i', rootOffset: 0, triad: 'min', seventh: 'min7', function: 'TONIC', chordScale: 'aeolian' },
  { degree: 'iiø', rootOffset: 2, triad: 'dim', seventh: 'min7b5', function: 'SUBDOMINANT', chordScale: 'locrian' },
  { degree: 'bIII', rootOffset: 3, triad: 'maj', seventh: 'maj7', function: 'TONIC', chordScale: 'ionian' },
  { degree: 'iv', rootOffset: 5, triad: 'min', seventh: 'min7', function: 'SUBDOMINANT', chordScale: 'dorian' },
  { degree: 'v', rootOffset: 7, triad: 'min', seventh: 'min7', chordScale: 'phrygian' },
  { degree: 'bVI', rootOffset: 8, triad: 'maj', seventh: 'maj7', function: 'SUBDOMINANT', chordScale: 'lydian' },
  { degree: 'bVII', rootOffset: 10, triad: 'maj', seventh: '7', chordScale: 'mixolydian' },
];

export const NATURAL_MINOR_SOURCE: SourceRef[] = [
  { kind: 'BOOK_EXPLICIT', printedPages: [57, 58, 59, 60, 61, 62, 63], chapter: 'Part 2 / ナチュラル・マイナー' },
  { kind: 'BOOK_EXPLICIT', printedPages: [73, 74, 75], chapter: 'Part 2 / コード・スケール2' },
];

export interface TensionRule {
  contextId: string;
  available: TensionToken[];
  avoid: TensionToken[];
  chordScale: string;
  source: SourceRef[];
}

/**
 * Major-key diatonic tension table.
 * These are the source book's "basic" tensions after removing avoid notes.
 */
export const MAJOR_DIATONIC_TENSIONS: TensionRule[] = [
  {
    contextId: 'Imaj7',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'ionian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'ii7',
    available: ['9', '11'],
    avoid: ['13'],
    chordScale: 'dorian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'iii7',
    available: ['11'],
    avoid: ['b9', 'b13'],
    chordScale: 'phrygian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'IVmaj7',
    available: ['9', '#11', '13'],
    avoid: [],
    chordScale: 'lydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52, 53], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'V7_major_basic',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'mixolydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52, 54], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'vi7',
    available: ['9', '11'],
    avoid: ['b13'],
    chordScale: 'aeolian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52], chapter: 'Part 2 / テンション1' }],
  },
  {
    contextId: 'vii_m7b5',
    available: ['11', 'b13'],
    avoid: ['b9'],
    chordScale: 'locrian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [52], chapter: 'Part 2 / テンション1' }],
  },
];

export const NATURAL_MINOR_TENSIONS: TensionRule[] = [
  {
    contextId: 'i7_natural_minor',
    available: ['9', '11'],
    avoid: ['b13'],
    chordScale: 'aeolian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [85], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'ii_m7b5_natural_minor',
    available: ['11', 'b13'],
    avoid: ['b9'],
    chordScale: 'locrian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [85], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'bIIImaj7_natural_minor',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'ionian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [85], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'iv7_natural_minor',
    available: ['9', '11'],
    avoid: ['13'],
    chordScale: 'dorian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [85], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'v7_natural_minor',
    available: ['11'],
    avoid: ['b9', 'b13'],
    chordScale: 'phrygian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [86], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'bVImaj7_natural_minor',
    available: ['9', '#11', '13'],
    avoid: [],
    chordScale: 'lydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [86], chapter: 'Part 2 / テンション2' }],
  },
  {
    contextId: 'bVII7_natural_minor',
    available: ['9', '13'],
    avoid: ['11'],
    chordScale: 'mixolydian',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [86], chapter: 'Part 2 / テンション2' }],
  },
];

/**
 * The book treats dominant-7 tensions as scale/context dependent.
 * Potential tension families for V7:
 * b9 / 9 / #9, #11(=b5), b13 / 13.
 */
export const DOMINANT_TENSION_UNIVERSE: {
  potential: TensionToken[];
  basicMajorKey: TensionToken[];
  basicMinorKey: TensionToken[];
  source: SourceRef[];
} = {
  potential: ['b9', '9', '#9', '#11', 'b13', '13'],
  basicMajorKey: ['9', '13'],
  basicMinorKey: ['b9', 'b13'],
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [54, 55, 56], chapter: 'Part 2 / テンション1' },
    { kind: 'BOOK_EXPLICIT', printedPages: [85, 87, 88, 89, 90, 91], chapter: 'Part 2 / テンション2' },
  ],
};

export interface DominantScaleOption {
  scaleId: string;
  tensions: TensionToken[];
  typicalContext: string;
  source: SourceRef[];
}

export const DOMINANT_SCALE_OPTIONS: DominantScaleOption[] = [
  {
    scaleId: 'mixolydian',
    tensions: ['9', '13'],
    typicalContext: 'major-key primary V7 basic',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [52, 54], chapter: 'Part 2 / テンション1' }],
  },
  {
    scaleId: 'harmonicMinorP5Below',
    tensions: ['b9', 'b13'],
    typicalContext: 'minor-key V7 basic',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [87, 88], chapter: 'Part 2 / テンション2' }],
  },
  {
    scaleId: 'altered',
    tensions: ['b9', '#9', 'b13'],
    typicalContext: 'altered dominant; #11/b5 color is also available in the scale',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [81, 82, 90], chapter: 'Part 2 / オルタード・スケール' }],
  },
  {
    scaleId: 'lydianDominant',
    tensions: ['9', '#11', '13'],
    typicalContext: 'substitute dominant / dominant using Lydian b7',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [124, 127, 136, 137, 138], chapter: 'Part 3 / 代理ドミナント' }],
  },
];

export const AVOID_NOTE_HEURISTIC = {
  statement:
    'A candidate extension a semitone above a chord tone is generally treated as an avoid note; explicit chord-scale tables override this heuristic.',
  hardGate: false,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [47, 48, 49, 50, 51], chapter: 'Part 2 / テンション1' },
  ] satisfies SourceRef[],
};

export interface MotionRule {
  id: string;
  from: string;
  to: string;
  rootMotionSemitones?: number;
  strength?: 'strong' | 'normal';
  source: SourceRef[];
}

export const FUNCTIONAL_MOTIONS: MotionRule[] = [
  {
    id: 'dominant_motion',
    from: 'V7',
    to: 'I',
    rootMotionSemitones: 5,
    strength: 'strong',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [28, 29, 30], chapter: 'Part 2 / メジャー・ダイアトニックのコード進行' }],
  },
  {
    id: 'related_ii_v',
    from: 'IIm7',
    to: 'V7',
    rootMotionSemitones: 5,
    strength: 'strong',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [174, 175, 176, 177, 178, 179], chapter: 'Part 4 / リレイテッドIIm7' }],
  },
];

export interface FunctionSubstitutionGroup {
  keyMode: 'major';
  function: HarmonicFunction;
  degrees: string[];
  notes?: string;
  source: SourceRef[];
}

export const MAJOR_FUNCTION_GROUPS: FunctionSubstitutionGroup[] = [
  {
    keyMode: 'major',
    function: 'TONIC',
    degrees: ['Imaj7', 'iii7', 'vi7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [31, 32, 33, 34, 36], chapter: 'Part 2 / 代理コード' }],
  },
  {
    keyMode: 'major',
    function: 'SUBDOMINANT',
    degrees: ['ii7', 'IVmaj7'],
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [31, 34, 35, 36], chapter: 'Part 2 / 代理コード' }],
  },
  {
    keyMode: 'major',
    function: 'DOMINANT',
    degrees: ['V7', 'vii_m7b5'],
    notes: 'The source notes vii_m7b5 as a dominant substitute but treats it as less common in practical use.',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [33, 34, 36], chapter: 'Part 2 / 代理コード' }],
  },
];

export interface SecondaryDominantRule {
  targetDegree: string;
  dominantRootOffsetFromKey: number;
  dominantQuality: '7';
  targetRootOffsetFromKey: number;
  source: SourceRef[];
}

/** In major key. The primary V7 is excluded because it is already diatonic. */
export const SECONDARY_DOMINANTS_MAJOR: SecondaryDominantRule[] = [
  { targetDegree: 'ii', dominantRootOffsetFromKey: 9, dominantQuality: '7' as const, targetRootOffsetFromKey: 2, source: [] }, // VI7 -> ii
  { targetDegree: 'iii', dominantRootOffsetFromKey: 11, dominantQuality: '7' as const, targetRootOffsetFromKey: 4, source: [] }, // VII7 -> iii
  { targetDegree: 'IV', dominantRootOffsetFromKey: 0, dominantQuality: '7' as const, targetRootOffsetFromKey: 5, source: [] }, // I7 -> IV
  { targetDegree: 'V', dominantRootOffsetFromKey: 2, dominantQuality: '7' as const, targetRootOffsetFromKey: 7, source: [] }, // II7 -> V
  { targetDegree: 'vi', dominantRootOffsetFromKey: 4, dominantQuality: '7' as const, targetRootOffsetFromKey: 9, source: [] }, // III7 -> vi
].map((x) => ({
  ...x,
  source: [{ kind: 'BOOK_EXPLICIT', printedPages: [123, 124, 125, 126, 127, 128, 129, 130, 131], chapter: 'Part 3 / セカンダリー・ドミナント' }],
}));

export interface SubstituteDominantRule {
  originalDominantRootOffset: number;
  substituteRootOffset: number;
  rootDistanceSemitones: 6;
  sharedGuideToneBehavior: '3rd_and_7th_swap_roles';
  preferredScale?: string;
  source: SourceRef[];
}

export const SUBSTITUTE_DOMINANT = {
  rootTransformSemitones: 6,
  sharedGuideToneBehavior: '3rd_and_7th_swap_roles' as const,
  preferredScale: 'lydianDominant',
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [132, 133, 134, 135, 136, 137, 138], chapter: 'Part 3 / 代理ドミナント' },
  ] satisfies SourceRef[],
};

/**
 * General resolver:
 * dominantRoot -> targetRoot a perfect fourth above / perfect fifth below.
 * substituteDominantRoot = dominantRoot + 6 semitones.
 */
export function getSubstituteDominantRoot(dominantRootPc: number): number {
  return (dominantRootPc + 6) % 12;
}

export interface RelatedIiRule {
  dominantType: 'primary' | 'secondary' | 'substitute' | 'secondarySubstitute';
  iiRootOffsetFromDominant: number;
  iiQuality: 'min7';
  source: SourceRef[];
}

export const RELATED_II_RULE: RelatedIiRule = {
  dominantType: 'primary',
  iiRootOffsetFromDominant: 7, // dominant G -> related ii D: +7 mod 12
  iiQuality: 'min7',
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [174, 175, 176, 177, 178, 179], chapter: 'Part 4 / リレイテッドIIm7' },
  ],
};

export const RELATED_II_APPLICABILITY = {
  supports: ['primary', 'secondary', 'substitute', 'secondarySubstitute'] as const,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [174], chapter: 'Part 4 / リレイテッドIIm7' },
  ] satisfies SourceRef[],
};

export interface SlashChordPolicy {
  id: string;
  bassType: 'chordTone' | 'nonChordTone';
  identityRule: string;
  source: SourceRef[];
}

export const SLASH_CHORD_RULES: SlashChordPolicy[] = [
  {
    id: 'chord_tone_bass',
    bassType: 'chordTone',
    identityRule: 'Chord quality/function is retained; slash notation specifies inversion/bass choice.',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [113, 114, 115], chapter: 'Part 3 / 分数コード' }],
  },
  {
    id: 'non_chord_tone_bass',
    bassType: 'nonChordTone',
    identityRule: 'Treat as a distinct slash harmony; do not force the bass pitch into the upper chord-tone set.',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [118, 119, 120, 121, 122], chapter: 'Part 3 / 分数コード' }],
  },
];

export const SUS_RULES = {
  replaceThirdWithFourth: true,
  allowThirdSimultaneously: false,
  defaultResolution: '4_to_3',
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [104, 105, 106, 107, 108], chapter: 'Part 3 / sus4コード' },
  ] satisfies SourceRef[],
};

export const ADD_RULES = {
  add9HasNoSeventhByDefinition: true,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [109, 110, 111, 112], chapter: 'Part 3 / addコード' },
  ] satisfies SourceRef[],
};

export interface DiminishedRuleSet {
  intervalStackSemitones: number;
  symmetryCycleSemitones: number;
  equivalentRootCount: number;
  passingDiminishedUse: boolean;
  source: SourceRef[];
}

export const DIMINISHED_RULES: DiminishedRuleSet = {
  intervalStackSemitones: 3,
  symmetryCycleSemitones: 3,
  equivalentRootCount: 4,
  passingDiminishedUse: true,
  source: [
    { kind: 'BOOK_EXPLICIT', printedPages: [145, 146, 147, 148, 149, 150, 151, 152, 153], chapter: 'Part 3 / ディミニッシュ・コード' },
  ],
};

export interface BorrowedChordRule {
  id: string;
  sourceMode: 'naturalMinor' | 'harmonicMinor' | 'melodicMinor';
  degree: string;
  use: string;
  source: SourceRef[];
}

/**
 * The book's practical mixture section emphasizes mixing same-tonic minor-family
 * diatonic chords into major-key harmony. These are representative, not an
 * exhaustive "only allowed borrowed chords" list.
 */
export const MAJOR_MINOR_MIXTURE: BorrowedChordRule[] = [
  {
    id: 'ivm7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'iv7',
    use: 'subdominant-minor color in major key',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [169, 170, 171, 172, 173], chapter: 'Part 4 / メジャー&マイナー・コードのミックス' }],
  },
  {
    id: 'bVImaj7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'bVImaj7',
    use: 'borrowed minor-family color',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [169, 170, 171, 172, 173], chapter: 'Part 4 / メジャー&マイナー・コードのミックス' }],
  },
  {
    id: 'bVII7_in_major',
    sourceMode: 'naturalMinor',
    degree: 'bVII7',
    use: 'borrowed minor-family color',
    source: [{ kind: 'BOOK_DIAGRAM', printedPages: [169, 170, 171, 172, 173], chapter: 'Part 4 / メジャー&マイナー・コードのミックス' }],
  },
];

export interface ProgressionVocabulary {
  id: string;
  purpose: string;
  generatorScope: 'candidate' | 'transform';
  source: SourceRef[];
}

export const PROGRESSION_VOCABULARY: ProgressionVocabulary[] = [
  {
    id: 'turnaround',
    purpose: 'Create a return-to-tonic / loop-oriented closing motion using functional substitutions and dominants.',
    generatorScope: 'candidate',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [210, 211, 212, 213, 214], chapter: 'Part 4 / ターンアラウンド' }],
  },
  {
    id: 'line_cliche',
    purpose: 'Keep a chordal center while moving one internal/top voice chromatically or stepwise.',
    generatorScope: 'transform',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [215, 216, 217, 218, 219, 220], chapter: 'Part 4 / ライン・クリシェ' }],
  },
  {
    id: 'blues_function',
    purpose: 'Treat blues harmony as its own functional vocabulary rather than forcing strict diatonic-major logic.',
    generatorScope: 'candidate',
    source: [{ kind: 'BOOK_EXPLICIT', printedPages: [180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204], chapter: 'Part 4 / ブルースの音楽理論的な考察' }],
  },
];

/**
 * Source-derived voicing principles from Part 4.
 * NOTE: the six-string limit is guitar-specific and must NOT become a global
 * piano/keyboard polyphony limit in Chord Palette.
 */
export const VOICING_THEORY = {
  guideTones: {
    seventhChordCharacteristicDegrees: ['3rd', '7th'],
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [224, 225, 228, 229, 230], chapter: 'Part 4 / 実践的ギター・ボイシング' },
    ] satisfies SourceRef[],
  },

  fifthOmission: {
    normallyMayOmitPerfectFifth: true,
    retainIfFifthIsAltered: true,
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [227, 228], chapter: 'Part 4 / 実践的ギター・ボイシング' },
    ] satisfies SourceRef[],
  },

  rootOmission: {
    allowedWhenBassProvidesRoot: true,
    rationale: 'Rootless upper voicing increases voicing freedom; preserve 3rd/7th identity.',
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [226, 227, 228, 229], chapter: 'Part 4 / 実践的ギター・ボイシング' },
    ] satisfies SourceRef[],
  },

  extensionConstruction: {
    preferredBaseForSeventhChords: ['3rd', '7th'],
    thenAddAvailableTensions: true,
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [224, 229, 230], chapter: 'Part 4 / 実践的ギター・ボイシング' },
    ] satisfies SourceRef[],
  },

  guitarPhysicalLimit: {
    maxSimultaneousStrings: 6,
    applyGlobally: false,
    source: [
      { kind: 'BOOK_EXPLICIT', printedPages: [226], chapter: 'Part 4 / 実践的ギター・ボイシング' },
    ] satisfies SourceRef[],
  },
};

/**
 * Chord Palette policy layer.
 * These are implementation proposals motivated by the source, but are NOT claims
 * that the book itself declares these exact hard gates.
 */
export const CHORD_PALETTE_HARMONY_POLICY = {
  provenance: {
    kind: 'APP_POLICY_PROPOSED' as const,
    printedPages: [],
    chapter: 'Chord Palette implementation layer',
  },

  validationOrder: [
    'resolveChordDefinition',
    'resolveChordScaleAndTensions',
    'validatePitchClassMembership',
    'validateSlashBassSeparately',
    'validateRequiredCharacteristicTones',
    'validateAvoidNotes',
    'validateRegisterAndPairwiseCollisions',
    'applyVoiceLeadingScore',
  ],

  chordToneMembership: {
    coreChordTonesAreAlwaysAllowed: true,
    tensionsRequireExplicitContextRule: true,
    doNotAutoAddExtensionsFromChordSymbol: true,
  },

  voicing: {
    perfectFifthOmissionDefault: true,
    alteredFifthOmissionDefault: false,
    preserveGuideTonesInSeventhChords: true,
    allowRootlessUpperVoicingOnlyWhenBassRoleSuppliesRoot: true,
  },

  collisionSafety: {
    // App-specific defaults from the prior Chord Palette discussion.
    // These are intentionally separate from book-derived theory.
    rejectDirectMinorSecondSemitones: 1,
    rejectDirectMinorNinthSemitones: 13,
    doNotBanTritoneWhenChordDefinitionRequiresIt: true,
    doNotBanMajorSeventhWhenChordDefinitionRequiresIt: true,
  },

  lowRegister: {
    // Proposed safe defaults; tune per instrument.
    belowMidi48RejectIntervalsSmallerThanSemitones: 7,
    belowMidi36RejectIntervalsSmallerThanSemitones: 12,
  },
};

export interface TheoryDatabase {
  version: string;
  sourceTitle: string;
  chordFormulas: typeof CHORD_FORMULAS;
  scales: typeof SCALE_FORMULAS;
  majorDiatonic: typeof MAJOR_DIATONIC;
  naturalMinorDiatonic: typeof NATURAL_MINOR_DIATONIC;
  majorTensions: typeof MAJOR_DIATONIC_TENSIONS;
  naturalMinorTensions: typeof NATURAL_MINOR_TENSIONS;
  dominantTensions: typeof DOMINANT_TENSION_UNIVERSE;
  dominantScaleOptions: typeof DOMINANT_SCALE_OPTIONS;
  majorFunctionGroups: typeof MAJOR_FUNCTION_GROUPS;
  secondaryDominants: typeof SECONDARY_DOMINANTS_MAJOR;
  substituteDominant: typeof SUBSTITUTE_DOMINANT;
  relatedIi: typeof RELATED_II_RULE;
  slashChords: typeof SLASH_CHORD_RULES;
  diminished: typeof DIMINISHED_RULES;
  borrowedChords: typeof MAJOR_MINOR_MIXTURE;
  progressionVocabulary: typeof PROGRESSION_VOCABULARY;
  voicingTheory: typeof VOICING_THEORY;
  appPolicy: typeof CHORD_PALETTE_HARMONY_POLICY;
}

export const CHORD_PALETTE_THEORY_DB: TheoryDatabase = {
  version: '0.1.0',
  sourceTitle: '養父 貴『ギターで覚える音楽理論』',
  chordFormulas: CHORD_FORMULAS,
  scales: SCALE_FORMULAS,
  majorDiatonic: MAJOR_DIATONIC,
  naturalMinorDiatonic: NATURAL_MINOR_DIATONIC,
  majorTensions: MAJOR_DIATONIC_TENSIONS,
  naturalMinorTensions: NATURAL_MINOR_TENSIONS,
  dominantTensions: DOMINANT_TENSION_UNIVERSE,
  dominantScaleOptions: DOMINANT_SCALE_OPTIONS,
  majorFunctionGroups: MAJOR_FUNCTION_GROUPS,
  secondaryDominants: SECONDARY_DOMINANTS_MAJOR,
  substituteDominant: SUBSTITUTE_DOMINANT,
  relatedIi: RELATED_II_RULE,
  slashChords: SLASH_CHORD_RULES,
  diminished: DIMINISHED_RULES,
  borrowedChords: MAJOR_MINOR_MIXTURE,
  progressionVocabulary: PROGRESSION_VOCABULARY,
  voicingTheory: VOICING_THEORY,
  appPolicy: CHORD_PALETTE_HARMONY_POLICY,
};

export default CHORD_PALETTE_THEORY_DB;
