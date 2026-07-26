/**
 * Key-independent chord definition — single source for symbol, intervals, and UI labels.
 * See project/docs/design/ChordDataModelDesign.md and project/docs/music/ChordDefinitions.md.
 */

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dominant'
  | 'diminished'
  | 'halfDim'
  | 'augmented'
  | 'suspended'
  | 'other';

export type ChordDefCategory =
  | 'triad'
  | 'seventh'
  | 'tension'
  | 'altered'
  | 'slash'
  | 'borrowed'
  | 'secondary';

export type ChordDefinition = {
  /** Stable id, e.g. "maj9_sharp11". */
  id: string;
  /** Canonical symbol appended to the spelled root, e.g. "maj9(#11)". */
  symbol: string;
  /** Short UI pill label, e.g. "maj9(#11)" or "6/9". */
  buttonLabel: string;
  quality: ChordQuality;
  /** Semitone offsets from the root — sole source for MIDI pitch classes. */
  /** Readonly: every caller shares the one catalog entry, so it must not be sorted in place. */
  intervals: readonly number[];
  extensions: string[];
  alterations: string[];
  /** Primary degree(s) that offer this chord, or null if not degree-scoped. */
  degree: string | string[] | null;
  category: ChordDefCategory;
  /** Lower = earlier in UI lists. */
  priority: number;
  tags: string[];
};

/** Legacy `suffix` string used in ChordEvent / LibraryChord (equals symbol for new defs). */
export type ChordSuffix = string;
