/**
 * Register thresholds per instrument.
 *
 * The low interval limit is a property of the instrument, not of harmony: the same
 * perfect fourth that is clean on a guitar's middle strings turns to mud on a
 * piano's lowest octave. Keeping the numbers here means a new instrument ships a
 * profile instead of a branch inside a rule.
 */

import type { InstrumentCollisionProfile } from './types';
import type { InstrumentId } from '@/types';

/**
 * Acoustic piano. The two windows are the contract's safe defaults: under C3 a
 * pair must span a fifth, and under C2 it must span an octave.
 */
export const PIANO_COLLISION_PROFILE: InstrumentCollisionProfile = {
  id: 'piano',
  lowestPitch: 21,
  highestPitch: 108,
  lowIntervalLimits: [
    { belowPitch: 36, minDistance: 12 },
    { belowPitch: 48, minDistance: 7 },
  ],
  majorSecondFloor: 60,
};

/**
 * Guitars voice their own way and their lowest note is E2, so the sub-C2 window
 * never applies. Everything else matches the piano defaults until a listening
 * session says otherwise.
 */
const GUITAR_COLLISION_PROFILE: InstrumentCollisionProfile = {
  id: 'guitar',
  lowestPitch: 40,
  highestPitch: 88,
  lowIntervalLimits: [{ belowPitch: 48, minDistance: 7 }],
  majorSecondFloor: 60,
};

const BY_INSTRUMENT: Readonly<Record<InstrumentId, InstrumentCollisionProfile>> = {
  piano: PIANO_COLLISION_PROFILE,
  ePiano: { ...PIANO_COLLISION_PROFILE, id: 'ePiano' },
  acousticGuitar: { ...GUITAR_COLLISION_PROFILE, id: 'acousticGuitar' },
  electricGuitar: { ...GUITAR_COLLISION_PROFILE, id: 'electricGuitar' },
  strings: { ...PIANO_COLLISION_PROFILE, id: 'strings' },
};

export function collisionProfileFor(instrumentId: InstrumentId): InstrumentCollisionProfile {
  return BY_INSTRUMENT[instrumentId] ?? PIANO_COLLISION_PROFILE;
}

/**
 * The same profile moved by whole octaves. Octave shift transposes the performance
 * but not the instrument, so the register windows have to travel with the notes or
 * a shifted-down voicing would escape the low interval limit.
 */
export function shiftProfile(
  profile: InstrumentCollisionProfile,
  octaveShift: number,
): InstrumentCollisionProfile {
  if (octaveShift === 0) return profile;
  const delta = octaveShift * 12;
  return {
    ...profile,
    lowIntervalLimits: profile.lowIntervalLimits.map((limit) => ({
      belowPitch: limit.belowPitch + delta,
      minDistance: limit.minDistance,
    })),
    majorSecondFloor: profile.majorSecondFloor + delta,
  };
}
