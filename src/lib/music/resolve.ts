import {
  getDefinitionById,
  getDefinitionBySymbol,
  pitchClassesFromIntervals,
} from '@/lib/music/definitions/catalog';
import { chordMidiNotesFromParts } from '@/lib/music/midi';
import type { ChordDefinition } from '@/lib/music/types';
import type { MajorKey } from '@/types';

export type ResolvedChord = {
  definitionId: string;
  key: MajorKey;
  displayName: string;
  buttonLabel: string;
  degreeLabel: string;
  rootOffset: number;
  bassOffset?: number;
  suffix: string;
  midiNotes: number[];
  pitchClasses: number[];
};

export function resolveDefinition(
  def: ChordDefinition,
  opts: {
    key: MajorKey;
    rootName: string;
    rootOffset: number;
    tonicPc: number;
    degreeLabel: string;
    bassOffset?: number;
    bassName?: string;
  },
): ResolvedChord {
  const displayName =
    opts.bassName != null
      ? `${opts.rootName}${def.symbol}/${opts.bassName}`
      : `${opts.rootName}${def.symbol}`;

  const midiNotes = chordMidiNotesFromParts(
    {
      rootOffset: opts.rootOffset,
      suffix: def.symbol,
      definitionId: def.id,
      bassOffset: opts.bassOffset,
    },
    opts.tonicPc,
  );

  return {
    definitionId: def.id,
    key: opts.key,
    displayName,
    buttonLabel: def.buttonLabel,
    degreeLabel: opts.degreeLabel,
    rootOffset: opts.rootOffset,
    bassOffset: opts.bassOffset,
    suffix: def.symbol,
    midiNotes,
    pitchClasses: pitchClassesFromIntervals(def.intervals),
  };
}

/** Map a legacy event suffix to a catalog definition (falls back to major triad). */
export function definitionForSuffix(suffix: string): ChordDefinition {
  return getDefinitionBySymbol(suffix) ?? getDefinitionBySymbol('')!;
}

export function definitionForId(id: string): ChordDefinition | undefined {
  return getDefinitionById(id);
}
