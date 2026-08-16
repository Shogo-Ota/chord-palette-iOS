/**
 * Rhythm layer types.
 *
 * A *rhythm* is what the player picks in the accompaniment selector. Until now the
 * engine decided what a pick meant with a hard-coded branch (`isFeelId(...)` else a
 * direct style lookup), which works for five choices and stops working the moment a
 * rhythm wants its own skeleton. This layer states the mapping as data instead, so
 * adding a rhythm is adding a table row rather than another branch.
 *
 * Two sources cover every case:
 *
 *  - `feel`  — the three tempo-adaptive feels. The base skeleton is chosen from tempo
 *    and drum groove, the feel's refinements land on it, and it always carries a
 *    Variation profile and groove-lock. Unchanged from before this layer existed.
 *  - `style` — the preset IS the rhythm. Used by the textures (block / arpeggio, which
 *    deliberately take neither Variation nor groove-lock) and by the authored rhythms,
 *    which take both so they breathe instead of repeating a fixed bar.
 */

import type { AccompanimentPattern } from '@/types';

import type { FeelId } from '../feel/types';
import type { StylePreset } from '../styles/types';
import type { VariationProfile } from '../variation/types';

/** How the engine builds a rhythm's skeleton. */
export type RhythmSource =
  | { kind: 'feel'; feelId: FeelId }
  | {
      /**
       * A self-contained accompaniment realizer selected through the independent
       * style registry. It owns notes, but still shares the common Final MIDI path.
       */
      kind: 'independent';
      beatsPerBar: number;
    }
  | {
      kind: 'style';
      style: StylePreset;
      /**
       * Intentful bar-level change (rests / ties / phrase fills). Omitted = the preset
       * plays as written, which is what the two textures want.
       */
      variation?: VariationProfile;
      /** Micro-humanization window multiplier. Omitted = 1 (unchanged). */
      humanizeScale?: number;
      /**
       * Nudge accents toward the drum groove's kick and backbeat. Omitted = false; the
       * textures stay off the groove so a block chord is a block chord under any kit.
       */
      grooveLock?: boolean;
    };

/** One entry of the accompaniment selector. */
export interface RhythmDefinition {
  /** The persisted, user-facing id (also the engine's `styleId`). */
  id: AccompanimentPattern;
  /** Chip label (Japanese, per the selector's naming). */
  label: string;
  /** One-line description shown under the selector. */
  hint: string;
  source: RhythmSource;
}
