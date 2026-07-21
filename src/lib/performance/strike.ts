/**
 * `Strike` — one scheduled hit on the grid, produced by the style skeleton
 * (`collectStrikes`) BEFORE micro-humanization. It is the unit the Musical
 * Variation layer (design §3-2) rewrites: rests drop strikes, ties/phrase-fill mark
 * them to hold, two/four-bar variation adds or removes them. Keeping the type in its
 * own module (rather than private to the engine) lets `variation/*` transform strikes
 * without importing the engine — preserving the layer boundary (domain-only, no
 * native/RN/Expo). The engine then flattens the (possibly rewritten) strikes to
 * per-pitch drafts and renders them.
 */

import type { TrackId } from './NoteEvent';

/** One scheduled hit on the grid before humanization. */
export interface Strike {
  bar: number;
  step: number;
  gridBeat: number;
  accent: number;
  ghost: boolean;
  pitches: number[];
  /**
   * Set by the Variation layer: this strike is held (tied) across the following
   * beat/rest instead of being clipped. The engine forces a near-full gate and a
   * `tie` articulation so the note sustains into the next strike (crossing the beat
   * boundary). Left undefined by the skeleton.
   */
  tie?: boolean;
  /**
   * Set by the Variation layer (phrase fill): this strike is a sustained phrase-end
   * chord — the same hold semantics as {@link Strike.tie} but flagged separately so
   * the intent is self-documenting.
   */
  sustain?: boolean;
}

/** Grid strikes grouped by voice — the working set the Variation layer rewrites. */
export type StrikesByTrack = Partial<Record<TrackId, Strike[]>>;
