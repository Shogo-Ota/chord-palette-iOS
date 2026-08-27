/**
 * Low interval limit — the bass end needs more air than the middle register.
 *
 * Two notes a fourth apart sit clean around middle C and turn to mud an octave and
 * a half below it, because the ear resolves fewer beats per second down there. The
 * requirement therefore depends on the absolute register of the lower note, which
 * is only knowable from MIDI numbers.
 *
 * Unisons and octaves are excluded: doubling a pitch class is a different question,
 * settled by the duplicate and octave rules.
 */

import type { IntervalVerdict } from './intervalRules';
import type { InstrumentCollisionProfile } from './types';

export function lowIntervalLimitVerdict(
  lowerNote: number,
  distance: number,
  profile: InstrumentCollisionProfile,
): IntervalVerdict | null {
  if (distance <= 0 || distance % 12 === 0) return null;
  for (const limit of profile.lowIntervalLimits) {
    if (lowerNote >= limit.belowPitch) continue;
    if (distance >= limit.minDistance) continue;
    return {
      ruleId: 'LOW_INTERVAL_LIMIT',
      result: 'REJECT',
      reason: `Below MIDI ${limit.belowPitch} a pair must span ${limit.minDistance} semitones; this one spans ${distance}.`,
    };
  }
  return null;
}
