import { realizePublicCityType1 } from './city';
import type { NoteEvent } from './NoteEvent';
import type { PerfChord } from './PerformanceEngine';

export type IndependentStyleInput = {
  chords: readonly PerfChord[];
  seed: number;
};

type IndependentStyleRealizer = (input: IndependentStyleInput) => NoteEvent[];

/**
 * Extension point for styles whose attack-group model cannot be represented by
 * the legacy step-pattern engine. The returned notes still enter the canonical
 * Harmony Gate, Final MIDI, playback and export pipeline.
 */
const INDEPENDENT_STYLE_REALIZERS: Readonly<Record<string, IndependentStyleRealizer>> = {
  city: ({ chords, seed }) => realizePublicCityType1(chords, seed).notes,
};

export function realizeIndependentStyle(
  styleId: unknown,
  input: IndependentStyleInput,
): NoteEvent[] | undefined {
  if (typeof styleId !== 'string') return undefined;
  return INDEPENDENT_STYLE_REALIZERS[styleId]?.(input);
}
