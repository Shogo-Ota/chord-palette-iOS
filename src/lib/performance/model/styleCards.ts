/**
 * What the 伴奏設定 screen is allowed to offer, plus the style-axis lookup the
 * engine reads. Pure data, no React Native.
 *
 * The five long-term style cards (Ballad / Band / City / Dance / R&B) used to
 * live here, each carrying a full internal preset that tapping applied. They are
 * gone from the product: the player now picks a pattern and a Type directly, so a
 * card that silently wrote `driving` or `beat16` into the session would put the
 * session on a rhythm the screen cannot even show as selected. Nothing here can
 * set a rhythm any more — the only write path is the player's own tap.
 *
 * The style AXIS is a different thing and stays: it is internal metadata that
 * groups every rhythm (including the ones only saved projects still use) onto a
 * style family, and the performance engine reads it to pick its profiles.
 */

import type { AccompanimentPattern } from '@/types';

import { axesFor } from './axes';
import type { AccompanimentStyle } from './types';

/**
 * Production rhythm families: ブロック / ナチュラル / シティ / バリエーション.
 * City is independently realized; the others retain their existing paths.
 * The other rhythms stay fully playable — saved projects keep using them —
 * they just are not offered as picks.
 */
export const CORE_PATTERNS: readonly AccompanimentPattern[] = [
  'block',
  'natural',
  'city',
  'arpeggio',
];

/** The style family a rhythm id belongs to (axis metadata). */
export function styleForRhythm(patternId: string): AccompanimentStyle | undefined {
  return axesFor(patternId)?.style;
}
