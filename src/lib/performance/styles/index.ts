/**
 * Style registry. Styles are looked up as data (no switch statement), and the
 * existing accompaniment ids (`block` | `eightBeat` | `sixteenthBeat` | `arpeggio`)
 * are mapped onto the three grooves so the engine can be driven straight from a
 * project's accompaniment setting when it is wired up in Step 3.
 */

import { BALLAD } from './ballad';
import { EIGHT_BEAT } from './eightBeat';
import { SIXTEEN_BEAT } from './sixteenBeat';
import type { StyleId, StylePreset } from './types';

export * from './types';

/** All built-in style presets, keyed by id. */
export const STYLES: Record<StyleId, StylePreset> = {
  eightBeat: EIGHT_BEAT,
  sixteenBeat: SIXTEEN_BEAT,
  ballad: BALLAD,
};

export const STYLE_IDS: StyleId[] = ['eightBeat', 'sixteenBeat', 'ballad'];

/**
 * Map an existing accompaniment id to a style. `block`/`arpeggio` fall back to the
 * sustained Ballad feel; unknown ids default to 8-Beat.
 */
const ACCOMPANIMENT_TO_STYLE: Record<string, StyleId> = {
  block: 'ballad',
  eightBeat: 'eightBeat',
  sixteenthBeat: 'sixteenBeat',
  arpeggio: 'ballad',
};

/** Resolve a `StyleId` (or a legacy accompaniment id) to a concrete preset. */
export function getStyle(id: StyleId | string): StylePreset {
  if (id in STYLES) return STYLES[id as StyleId];
  const mapped = ACCOMPANIMENT_TO_STYLE[id];
  return STYLES[mapped ?? 'eightBeat'];
}
