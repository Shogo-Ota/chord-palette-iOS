/**
 * Style × Energy DESIGN_TARGET profiles (v1.01).
 *
 * build ≈ identity (1 / 0) so existing accompaniment stays the migration default.
 * Ballad / Band / City diverge; Dance / R&B intentionally omit production numbers
 * (UI is 準備中) — resolve falls back to identity.
 *
 * Ballad quality direction (2026-08): accompaniment-MIDI retarget is the primary
 * path for rhythm/voicing. Energy knobs stay for UI A/B/サビ; do not drive Ballad
 * from commercial-song Energy aggregates.
 */

import type { AccompanimentStyle } from '../model/types';

import { IDENTITY_ENERGY, type AccompanimentEnergy, type EnergyProfile } from './types';

export { IDENTITY_ENERGY };

/** Pre-aggregate Ballad Energy table (migration-safe DESIGN_TARGET). */
const BALLAD: Record<AccompanimentEnergy, EnergyProfile> = {
  verse: {
    noteDensity: 0.72,
    attackDensity: 0.75,
    velocityDelta: -6,
    registerOffset: -2,
    voicingWidthDelta: -1,
    polyphonyDelta: -1,
    gateScale: 1.08,
    restRatioScale: 1.35,
    syncopationScale: 0.7,
    phraseVariationScale: 0.65,
    bassActivityScale: 0.75,
    drumActivityScale: 0.7,
    topNoteEmphasisScale: 0.7,
    bassApproachProbability: 0.05,
    phraseEnd: 'space',
  },
  // Exact identity — migration default must not change pre-Energy takes.
  build: { ...IDENTITY_ENERGY },
  chorus: {
    noteDensity: 1.15,
    attackDensity: 1.12,
    velocityDelta: 5,
    registerOffset: 3,
    voicingWidthDelta: 2,
    polyphonyDelta: 1,
    gateScale: 0.98,
    restRatioScale: 0.75,
    syncopationScale: 1.05,
    phraseVariationScale: 1.25,
    bassActivityScale: 1.2,
    drumActivityScale: 1.15,
    topNoteEmphasisScale: 1.35,
    bassApproachProbability: 0.22,
    phraseEnd: 'push',
  },
};

const BAND: Record<AccompanimentEnergy, EnergyProfile> = {
  verse: {
    noteDensity: 0.8,
    attackDensity: 0.78,
    velocityDelta: -5,
    registerOffset: 0,
    voicingWidthDelta: -1,
    polyphonyDelta: 0,
    gateScale: 1.0,
    restRatioScale: 1.15,
    syncopationScale: 0.85,
    phraseVariationScale: 0.7,
    bassActivityScale: 0.8,
    drumActivityScale: 0.85,
    topNoteEmphasisScale: 0.85,
    bassApproachProbability: 0.25,
    fillProbability: 0.15,
    openHatProbability: 0.1,
    phraseEnd: 'space',
  },
  build: { ...IDENTITY_ENERGY },
  chorus: {
    noteDensity: 1.12,
    attackDensity: 1.28,
    velocityDelta: 6,
    registerOffset: 2,
    voicingWidthDelta: 2,
    polyphonyDelta: 1,
    gateScale: 0.94,
    restRatioScale: 0.7,
    syncopationScale: 1.1,
    phraseVariationScale: 1.35,
    bassActivityScale: 1.3,
    drumActivityScale: 1.25,
    topNoteEmphasisScale: 1.4,
    bassApproachProbability: 0.55,
    fillProbability: 0.45,
    openHatProbability: 0.4,
    crashProbability: 0.25,
    phraseEnd: 'push',
  },
};

const CITY: Record<AccompanimentEnergy, EnergyProfile> = {
  verse: {
    noteDensity: 0.7,
    attackDensity: 0.85,
    velocityDelta: -4,
    registerOffset: 0,
    voicingWidthDelta: -1,
    polyphonyDelta: 0,
    gateScale: 0.92,
    restRatioScale: 1.4,
    syncopationScale: 0.75,
    phraseVariationScale: 0.7,
    bassActivityScale: 0.75,
    drumActivityScale: 0.8,
    topNoteEmphasisScale: 0.9,
    bassApproachProbability: 0.2,
    phraseEnd: 'space',
  },
  build: { ...IDENTITY_ENERGY },
  chorus: {
    // City chorus must NOT become "most notes" — keep rest/space.
    noteDensity: 1.05,
    attackDensity: 1.08,
    velocityDelta: 3,
    registerOffset: 2,
    voicingWidthDelta: 2,
    polyphonyDelta: 1,
    gateScale: 0.9,
    restRatioScale: 0.9,
    syncopationScale: 1.25,
    phraseVariationScale: 1.2,
    bassActivityScale: 1.2,
    drumActivityScale: 1.1,
    topNoteEmphasisScale: 1.2,
    bassApproachProbability: 0.45,
    phraseEnd: 'push',
  },
};

/**
 * Ready styles only. Dance / R&B omitted on purpose (準備中) — callers use
 * {@link energyProfileFor} which returns IDENTITY for missing entries.
 */
export const styleEnergyProfiles: Partial<
  Record<AccompanimentStyle, Record<AccompanimentEnergy, EnergyProfile>>
> = {
  ballad: BALLAD,
  band: BAND,
  city: CITY,
};

export function energyProfileFor(
  style: AccompanimentStyle,
  energy: AccompanimentEnergy,
): EnergyProfile {
  return styleEnergyProfiles[style]?.[energy] ?? IDENTITY_ENERGY;
}
