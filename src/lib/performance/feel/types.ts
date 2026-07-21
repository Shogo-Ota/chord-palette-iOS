/**
 * Feel layer types (design §3-1). A "Feel" is the USER-FACING accompaniment
 * character — Natural / Driving / Relaxed — while the concrete groove template, the
 * variation profile and the humanize scale it resolves to are internal (never shown).
 * This keeps the app's 5-way pattern choice (block/arpeggio + these three feels)
 * simple for musicians while the engine reasons in terms of templates + profiles.
 */

import type { StylePreset } from '../styles/types';
import type { VariationProfile } from '../variation/types';

/** The three data-driven feels (block/arpeggio bypass the Feel layer entirely). */
export type FeelId = 'natural' | 'driving' | 'relaxed';

/** Context a feel resolves against: tempo + which drum groove is playing. */
export interface FeelContext {
  tempoBpm: number;
  /** Drum groove id (pop8/pop16/rock8/rock16/soul16/bossaNova …). */
  grooveId: string;
}

/** The concrete engine inputs a feel resolves to (design §3-1). */
export interface ResolvedFeel {
  /** The chosen (refined) groove template skeleton. */
  template: StylePreset;
  /** The Musical Variation profile driving intentful change. */
  variation: VariationProfile;
  /** Multiplier applied to the micro-humanization window (tighter <1, looser >1). */
  humanizeScale: number;
}
