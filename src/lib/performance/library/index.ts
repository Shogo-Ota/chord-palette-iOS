/** Accompaniment pattern library — public API (implementation_v1.01 Phase 12). */

export type {
  LibraryPattern,
  PatternSourceType,
  PhraseVariation,
  ProfileSummary,
  ProgressionHints,
  RelativeNote,
} from './types';
export { validateLibraryPattern } from './validate';
export { extractPatternSummary } from './extractSummary';
export type { PatternExtractSummary } from './extractSummary';
export { realizeLibraryPattern } from './realize';
export type { RealizeChord, RealizeOptions } from './realize';
export {
  BALLAD_DEFAULT_LIBRARY_PATTERN_ID,
  BALLAD_PIANO_BROKEN_HOLD_V1,
  libraryPatternById,
} from './catalog';
