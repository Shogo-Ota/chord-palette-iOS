import type { ChordFunction } from '@/theme/tokens';

export type { ChordFunction };

/** 12 major keys supported in the MVP (display names use ♭ where flat). */
export type MajorKey =
  | 'C'
  | 'D♭'
  | 'D'
  | 'E♭'
  | 'E'
  | 'F'
  | 'G♭'
  | 'G'
  | 'A♭'
  | 'A'
  | 'B♭'
  | 'B';

/**
 * User-facing accompaniment choice (design §3 3-layer redesign). The two "beat"
 * ids (8beat/16beat) were retired from the UI in favour of the three data-driven
 * *feels* (natural/driving/relaxed) resolved by the Feel layer; `block`/`arpeggio`
 * still map 1:1 to their concrete styles. Legacy persisted values are migrated on
 * read via `normalizeAccompaniment` (src/lib/accompaniment.ts) — never here.
 */
export type AccompanimentPattern = 'block' | 'arpeggio' | 'natural' | 'driving' | 'relaxed';
export type InstrumentId = 'piano' | 'ePiano' | 'acousticGuitar' | 'electricGuitar' | 'strings';
export type GrooveId =
  | 'pop8'
  | 'pop16'
  | 'rock8'
  | 'rock16'
  | 'soul16'
  | 'clap'
  | 'bossaNova';

/** A diatonic chord candidate offered for the currently selected key. */
export type DiatonicChord = {
  /** Stable id, e.g. "Cmaj7". */
  id: string;
  /** Big label shown on the card, e.g. "Cmaj7". */
  displayName: string;
  /** Small roman-numeral degree, e.g. "I", "vii°". */
  degreeLabel: string;
  /** Harmonic function → drives the accent color. */
  function: ChordFunction;
  /** Semitones of the chord root above the tonic (drives auto-transposition). */
  rootOffset: number;
  /** Chord-quality suffix appended to the transposed root (e.g. '', 'm', 'maj7'). */
  suffix: string;
};

export type ChordDuration = 1 | 2 | 4; // beats: 1/4, 1/2, 1 bar

/** Where a library chord comes from — drives the tab it lives in. */
export type ChordCategory =
  | 'diatonic'
  | 'variation'
  | 'secondaryDominant'
  | 'modalInterchange'
  | 'slash';

/**
 * A selectable chord card in the chord library (diatonic / advanced / slash).
 * Carries everything the card needs: big name, small degree, function color,
 * a secondary sub-label (7th diff / resolution / bass) and an optional Pro flag.
 */
export type LibraryChord = {
  /** Stable id. */
  id: string;
  /** Big center label, e.g. "F", "A7", "C/E". */
  displayName: string;
  /** Small top label, e.g. "IV", "V7/ii", "♭III", "/E". */
  degreeLabel: string;
  /** Harmonic function → accent color + T/SD/D badge. */
  function: ChordFunction;
  /** Bottom pill sub-text, e.g. "Fmaj7", "→Dm7", "bass E". */
  subLabel?: string;
  category: ChordCategory;
  /** Bass note for slash chords, e.g. "E". */
  bassNote?: string;
  /** Variation id for variation chords, e.g. "sus4", "9". */
  variation?: string;
  /** Pro-only chord → lock icon + sunk styling. */
  isPro?: boolean;
  /** Semitones of the chord root above the tonic (drives auto-transposition). */
  rootOffset: number;
  /** Chord-quality suffix appended to the transposed root (e.g. '', 'm7', '7'). */
  suffix: string;
  /** Semitones of the bass above the tonic, for slash/on-chords. */
  bassOffset?: number;
};

/** A chord placed on the progression timeline. */
export type ChordEvent = {
  id: string;
  chordId: string;
  displayName: string;
  degreeLabel: string;
  function: ChordFunction;
  durationBeats: ChordDuration;
  isPro: boolean;
  /**
   * Degree data kept so the whole progression can auto-transpose on key change
   * (requirements §5.2). `rootOffset` = semitones of the root above the tonic;
   * `suffix` is the chord quality appended to the transposed root.
   */
  rootOffset: number;
  suffix: string;
  /** Semitones of the bass above the tonic, for slash/on-chords. */
  bassOffset?: number;
  /** Bass note when this event is a slash/on-chord. */
  bassNote?: string;
  /** Variation id when this event was built from a variation. */
  variation?: string;
  /** Source category (diatonic / variation / secondaryDominant / …). */
  category?: ChordCategory;
  /**
   * Key in which this chord was entered — the key its `degreeLabel` is meaningful
   * in. Stamped on insert/preset/append and updated on transpose; a change-mode
   * key switch leaves existing events' `keyContext` intact, which is how a single
   * progression can span multiple keys (modulation). Optional for backward
   * compatibility: legacy events without it fall back to the project/session key.
   */
  keyContext?: MajorKey;
};

export type PresetCategory = 'free' | 'pro';

/**
 * A preset chord stored by *degree*, not by fixed name, so presets auto-transpose
 * when the key changes (requirements §6). `offset` is semitones above the tonic;
 * `suffix` is appended to the transposed root (e.g. '', 'm', 'm7', 'maj7', '7').
 */
export type PresetChord = {
  offset: number;
  suffix: string;
  function: ChordFunction;
  degreeLabel: string;
  durationBeats: ChordDuration;
  /** Semitones of the bass above the tonic, for slash/on-chords (optional). */
  bassOffset?: number;
  /** Spelled bass note captured at authoring time (optional, recomputed on transpose). */
  bassNote?: string;
  /** Variation id when the source chord was a decorated variation (optional). */
  variation?: string;
};

export type Preset = {
  id: string;
  name: string;
  category: PresetCategory;
  /** Display chord string exactly as shown in the mock, e.g. "C · G · Am · F". */
  chordsDisplay: string;
  tags: string[];
  /** Left stripe / tag accent color. */
  accent: string;
  /** Degree-based chord sequence used to build a transposed progression. */
  chords: PresetChord[];
};

/** Project summary used on the list screen. */
export type ProjectSummary = {
  id: string;
  title: string;
  keyLabel: string;
  tempoBpm: number;
  bars: number;
  chordsDisplay: string;
  updatedLabel: string;
  accent: string;
};

export type TimeSignature = '4/4';

/** A full, locally-persisted composition (requirements §6, §11). */
export type Project = {
  id: string;
  title: string;
  key: MajorKey;
  tempoBpm: number;
  timeSignature: TimeSignature;
  instrumentId: InstrumentId;
  grooveId: GrooveId;
  accompanimentPattern: AccompanimentPattern;
  chordEvents: ChordEvent[];
  /** epoch millis */
  createdAt: number;
  /** epoch millis */
  updatedAt: number;
};

/** Fields accepted when creating a project; everything else gets a default. */
export type NewProjectInput = Partial<
  Pick<
    Project,
    | 'title'
    | 'key'
    | 'tempoBpm'
    | 'timeSignature'
    | 'instrumentId'
    | 'grooveId'
    | 'accompanimentPattern'
    | 'chordEvents'
  >
>;
