/**
 * The bridge between the theory database and Chord Palette's shipped chord vocabulary.
 *
 * Read-only and unwired: nothing in this folder is imported by a playback path, so adding
 * to it cannot change what the app sounds like. It exists so that theory questions —
 * "which quality is this", "which tensions does the key allow" — have one answer instead of
 * being re-derived wherever they come up.
 */

export {
  isResolved,
  qualitiesWithoutDefinition,
  resolveChordDefinition,
  type ResolvedChordDefinition,
  type UnresolvedChordDefinition,
} from './ChordDefinitionResolver';
