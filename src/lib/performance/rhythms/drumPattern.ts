/**
 * Which native drum pattern plays under a chosen accompaniment.
 *
 * Most rhythms leave the player's drum-groove pick alone. Named meters and hops
 * override it: a waltz under a 4/4 kit would wrap every four beats and fight the
 * oom-pah, and a shuffle under straight hats would hop in the piano alone. The
 * override is the smallest promise that keeps the bar readable.
 */

/** Accompaniments whose drum pattern must match the rhythm, not the groove picker. */
const DRUM_OVERRIDE: Readonly<Record<string, string>> = {
  shuffle: 'shuffle',
  swing: 'swing',
  reggae: 'reggae',
  sixEight: 'sixEight',
  waltz: 'waltz',
};

/**
 * Resolve the drumPatternId handed to the native engine. `grooveId` is the player's
 * pick; `accompanimentId` may replace it when the rhythm owns the meter or hop.
 */
export function drumPatternFor(grooveId: string, accompanimentId: string): string {
  return DRUM_OVERRIDE[accompanimentId] ?? grooveId;
}
