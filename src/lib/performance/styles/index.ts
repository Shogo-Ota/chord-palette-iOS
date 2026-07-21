/**
 * Style registry. Styles are looked up as data (no switch statement), and the
 * existing accompaniment ids (`block` | `eightBeat` | `sixteenthBeat` | `arpeggio`)
 * are mapped onto the three grooves so the engine can be driven straight from a
 * project's accompaniment setting when it is wired up in Step 3.
 */

import { ARPEGGIO } from './arpeggio';
import { BALLAD } from './ballad';
import { BLOCK } from './block';
import { EIGHT_BEAT } from './eightBeat';
import { NATURAL_COMP } from './naturalComp';
import { NATURAL_COMP_DENSE } from './naturalCompDense';
import { NATURAL_COMP_SPARSE } from './naturalCompSparse';
import { SIXTEEN_BEAT } from './sixteenBeat';
import type { StyleId, StylePreset } from './types';

export * from './types';

/** All built-in style presets, keyed by id. */
export const STYLES: Record<StyleId, StylePreset> = {
  block: BLOCK,
  eightBeat: EIGHT_BEAT,
  sixteenBeat: SIXTEEN_BEAT,
  arpeggio: ARPEGGIO,
  ballad: BALLAD,
  naturalComp: NATURAL_COMP,
  naturalCompSparse: NATURAL_COMP_SPARSE,
  naturalCompDense: NATURAL_COMP_DENSE,
};

export const STYLE_IDS: StyleId[] = [
  'block',
  'eightBeat',
  'sixteenBeat',
  'arpeggio',
  'ballad',
  'naturalComp',
  'naturalCompSparse',
  'naturalCompDense',
];

/**
 * Map an accompaniment id to a style — now 1:1 so every pattern sounds distinct
 * (previously `block` and `arpeggio` both fell back to Ballad). `ballad` stays
 * available as a style but is no longer referenced from an accompaniment id.
 * Unknown ids default to 8-Beat.
 */
const ACCOMPANIMENT_TO_STYLE: Record<string, StyleId> = {
  block: 'block',
  eightBeat: 'eightBeat',
  sixteenthBeat: 'sixteenBeat',
  arpeggio: 'arpeggio',
};

/** Resolve a `StyleId` (or a legacy accompaniment id) to a concrete preset. */
export function getStyle(id: StyleId | string): StylePreset {
  if (id in STYLES) return STYLES[id as StyleId];
  const mapped = ACCOMPANIMENT_TO_STYLE[id];
  return STYLES[mapped ?? 'eightBeat'];
}
