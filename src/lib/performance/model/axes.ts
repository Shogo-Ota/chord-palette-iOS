/**
 * Resolution from the thirteen selector rhythm ids to the three-axis model.
 *
 * The FEEL axis is derived from the rhythm's own preset (a swing spec at ≥ 2:1
 * is a shuffle, a gentler one is swing, none is straight), so this table can
 * never drift from what actually plays. The STYLE axis is authored metadata —
 * a provisional classification of each existing rhythm onto the future
 * five-style axis. Relabelling a style here changes no sound; it only changes
 * how the rhythm will be grouped when the style axis becomes selectable.
 */

import type { TrackId } from '../NoteEvent';
import { rhythmFor, beatsPerBarFor } from '../rhythms';
import type { AccompanimentStyle, InstrumentRole, RhythmAxes, RhythmFeel } from './types';

/**
 * Off-beat ratio at or above this reads as the hard triplet long-short (2:1 ≈
 * 0.667) = shuffle; below it, the push is the gentler jazz lilt = swing.
 */
const SHUFFLE_RATIO_MIN = 0.65;

/** Provisional style classification of the existing rhythms (metadata only). */
const STYLE_OF: Record<string, AccompanimentStyle> = {
  block: 'ballad',
  arpeggio: 'ballad',
  natural: 'band',
  city: 'city',
  driving: 'band',
  relaxed: 'ballad',
  beat8: 'band',
  beat16: 'city',
  shuffle: 'band',
  swing: 'band',
  bossa: 'city',
  reggae: 'band',
  sixEight: 'ballad',
  waltz: 'ballad',
};

/**
 * The rhythm-feel a rhythm id plays with, derived from its catalog definition.
 * Feel-sourced rhythms (natural / driving / relaxed) are straight by nature —
 * swing only reaches them at runtime via groove-lock, which is a pairing choice,
 * not the rhythm's own axis. Unknown ids resolve to `undefined`.
 */
export function rhythmFeelOf(id: string): RhythmFeel | undefined {
  const rhythm = rhythmFor(id);
  if (!rhythm) return undefined;
  if (rhythm.source.kind !== 'style') return 'straight';
  const swing = rhythm.source.style.swing;
  if (!swing) return 'straight';
  return swing.offbeatRatio >= SHUFFLE_RATIO_MIN ? 'shuffle' : 'swing';
}

/** The full axis coordinates of a rhythm id, or `undefined` for unknown ids. */
export function axesFor(id: string): RhythmAxes | undefined {
  const feel = rhythmFeelOf(id);
  const style = STYLE_OF[id];
  if (feel === undefined || style === undefined) return undefined;
  return { style, feel, beatsPerBar: beatsPerBarFor(id) };
}

/** Which instrument role each engine track fills today. */
export function roleForTrack(track: TrackId): InstrumentRole {
  switch (track) {
    case 'bass':
      return 'bass';
    case 'kick':
    case 'snare':
    case 'hat':
      return 'drums';
    default:
      return 'piano'; // chord + top: the piano-family comp
  }
}
