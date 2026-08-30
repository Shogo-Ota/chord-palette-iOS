/**
 * Permanent Voicing Quality corpus (Cases V1–V9).
 * Data only — no chord-symbol branches in the engine. Tests and dumps consume this.
 */

import type { ChordEvent } from '@/types';

import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { CHORD_CATALOG } from '@/lib/theory/definitions/catalog';

import { chordHarmonyFromEvent } from '../humanTemplate/chordHarmony';
import type { ChordHarmonyInput } from '../strictV2';

export type VoicingQualityCaseId =
  'V1' | 'V2' | 'V3' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9a' | 'V9b' | 'V9c';

export type VoicingQualityCase = {
  id: VoicingQualityCaseId;
  label: string;
  rootOffset: number;
  suffix: string;
  definitionId: string;
};

function catalogHas(definitionId: string): boolean {
  return CHORD_CATALOG.some((definition) => definition.id === definitionId);
}

/**
 * V4 (`Cm(maj7)`) is omitted because the catalog has no minor-major seventh.
 */
const ALL_VOICING_QUALITY_CASES: readonly VoicingQualityCase[] = [
  { id: 'V1', label: 'Fmaj7', rootOffset: 5, suffix: 'maj7', definitionId: 'maj7' },
  { id: 'V2', label: 'C7(♭9)', rootOffset: 0, suffix: '7(♭9)', definitionId: 'dom7_b9' },
  { id: 'V3', label: 'Cmaj7', rootOffset: 0, suffix: 'maj7', definitionId: 'maj7' },
  { id: 'V5', label: 'Cadd9', rootOffset: 0, suffix: 'add9', definitionId: 'add9' },
  { id: 'V6', label: 'Cmaj9', rootOffset: 0, suffix: 'maj9', definitionId: 'maj9' },
  { id: 'V7', label: 'Cm9', rootOffset: 0, suffix: 'm9', definitionId: 'm9' },
  { id: 'V8', label: 'C13', rootOffset: 0, suffix: '13', definitionId: 'dom13' },
  { id: 'V9a', label: 'C7(♭9)', rootOffset: 0, suffix: '7(♭9)', definitionId: 'dom7_b9' },
  { id: 'V9b', label: 'C7(#9)', rootOffset: 0, suffix: '7(#9)', definitionId: 'dom7_sharp9' },
  { id: 'V9c', label: 'C7(♭13)', rootOffset: 0, suffix: '7(♭13)', definitionId: 'dom7_b13' },
];

export const VOICING_QUALITY_CASES: readonly VoicingQualityCase[] =
  ALL_VOICING_QUALITY_CASES.filter((item) => catalogHas(item.definitionId));

export const BASELINE_PROGRESSION_IDS = ['H', 'F'] as const;

export function eventFromQualityCase(item: VoicingQualityCase): ChordEvent {
  return {
    id: `vq-${item.id}`,
    chordId: `vq-${item.definitionId}`,
    displayName: item.label,
    degreeLabel: '',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset: item.rootOffset,
    suffix: item.suffix,
    definitionId: item.definitionId,
  };
}

export function harmonyFromQualityCase(item: VoicingQualityCase): ChordHarmonyInput {
  return chordHarmonyFromEvent(eventFromQualityCase(item), 'C');
}

export function goldenHarmoniesById(id: (typeof BASELINE_PROGRESSION_IDS)[number]): {
  id: string;
  name: string;
  harmonies: ChordHarmonyInput[];
} {
  const progression = GOLDEN_PROGRESSIONS.find((item) => item.id === id);
  if (!progression) throw new Error(`unknown golden progression ${id}`);
  return {
    id: progression.id,
    name: progression.name,
    harmonies: progression.chords.map((chord) => chordHarmonyFromEvent(chord, progression.key)),
  };
}

export function transposedHarmony(
  harmony: ChordHarmonyInput,
  semitones: number,
): ChordHarmonyInput {
  const shift = ((semitones % 12) + 12) % 12;
  return {
    ...harmony,
    rootPc: (harmony.rootPc + shift) % 12,
    slashBassPc: harmony.slashBassPc == null ? undefined : (harmony.slashBassPc + shift) % 12,
  };
}
