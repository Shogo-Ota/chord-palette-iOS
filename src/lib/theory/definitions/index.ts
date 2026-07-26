/**
 * Theory Engine — chord definitions.
 *
 * The catalog is the single source of truth for which semitones a chord quality
 * spells. Everything downstream (voicing, MIDI, export) resolves through here
 * rather than keeping its own interval table, so a chord's spelling is defined
 * once and a new quality is added by editing data, not code.
 *
 * Lookup is by stable `definitionId` when the caller has one, falling back to the
 * legacy `suffix` string so projects saved before ids existed keep sounding the
 * same. Pure and RN/Expo-independent.
 */

export type {
  ChordDefCategory,
  ChordDefinition,
  ChordQuality,
  ChordSuffix,
} from '@/lib/theory/definitions/types';

export {
  CHORD_CATALOG,
  getDefinitionById,
  getDefinitionBySymbol,
  intervalsForSuffix,
  pitchClassesFromIntervals,
} from '@/lib/theory/definitions/catalog';

import {
  getDefinitionById,
  getDefinitionBySymbol,
  intervalsForSuffix,
} from '@/lib/theory/definitions/catalog';

/**
 * Semitone intervals for a chord, preferring the stable id and falling back to
 * the legacy suffix. Unknown input resolves to a major triad so a corrupt or
 * future id can never silence a chord.
 */
export function intervalsForChord(suffix: string, definitionId?: string): number[] {
  if (definitionId) {
    const byId = getDefinitionById(definitionId)?.intervals;
    if (byId) return byId;
  }
  return intervalsForSuffix(suffix);
}

/** The stable id a legacy suffix maps to, for backfilling projects saved without one. */
export function definitionIdForSuffix(suffix: string): string | undefined {
  return getDefinitionBySymbol(suffix)?.id;
}
