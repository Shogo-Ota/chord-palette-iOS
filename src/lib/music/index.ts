export type { ChordDefinition, ChordDefCategory, ChordQuality, ChordSuffix } from '@/lib/music/types';
export type { ResolvedChord } from '@/lib/music/resolve';
export type { VariationId, ChordVariationMeta } from '@/lib/music/variations';

export {
  CHORD_CATALOG,
  getDefinitionById,
  getDefinitionBySymbol,
  intervalsForSuffix,
  pitchClassesFromIntervals,
} from '@/lib/music/definitions/catalog';

export {
  CHORD_VARIATIONS,
  availableVariations,
  variationSuffix,
  variationMeta,
} from '@/lib/music/variations';

export {
  chordMidiNotesFromParts,
  bodyPitchClasses,
  CHORD_ROOT_MIDI,
  BASS_ROOT_MIDI,
  SUB_BASS_ROOT_MIDI,
} from '@/lib/music/midi';

export { resolveDefinition, definitionForSuffix, definitionForId } from '@/lib/music/resolve';
