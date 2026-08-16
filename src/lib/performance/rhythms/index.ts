/**
 * Rhythms — public API.
 *
 * The catalog is the single source of truth for what the accompaniment selector
 * offers and what each choice means to the engine, so the screen and the engine
 * cannot drift apart. Lookups are by id and total: a raw string that names no rhythm
 * returns `undefined` rather than throwing, which is what lets a legacy or direct
 * style id (`eightBeat`, `ballad`, …) keep flowing down the engine's older path.
 */

import type { AccompanimentPattern } from '@/types';

import { RHYTHMS } from './catalog';
import type { RhythmDefinition } from './types';

export type { RhythmDefinition, RhythmSource } from './types';
export { RHYTHMS } from './catalog';
export { drumPatternFor } from './drumPattern';

const BY_ID = new Map<string, RhythmDefinition>(RHYTHMS.map((r) => [r.id, r]));

/** Every rhythm id, in selector order. */
export const RHYTHM_IDS: readonly AccompanimentPattern[] = RHYTHMS.map((r) => r.id);

/** The rhythm a raw id names, or `undefined` when it names none. */
export function rhythmFor(id: unknown): RhythmDefinition | undefined {
  return typeof id === 'string' ? BY_ID.get(id) : undefined;
}

/** Whether a raw id names a rhythm in the catalog. */
export function isRhythmId(id: unknown): id is AccompanimentPattern {
  return rhythmFor(id) !== undefined;
}

/** Beats per bar the chosen accompaniment asks the engine (and the drums) to use. */
export function beatsPerBarFor(accompanimentId: string): number {
  const rhythm = rhythmFor(accompanimentId);
  if (rhythm?.source.kind === 'style') return rhythm.source.style.beatsPerBar;
  if (rhythm?.source.kind === 'independent') return rhythm.source.beatsPerBar;
  return 4;
}
