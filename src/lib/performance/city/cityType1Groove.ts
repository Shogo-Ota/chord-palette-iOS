import type { VoicingMask } from '../chordComping';
import type { CityType1CandidateId } from './types';

export type CityType1GrooveAttack = {
  onsetBeat: number;
  durationBeat: number;
  gapToNextAttackBeat: number;
  relativeVelocity: number;
  accent: 'STRONG' | 'WEAK';
};

export type CityType1GrooveAsset = {
  id: 'city.type1.v1';
  cycleBeats: 4;
  attacks: readonly CityType1GrooveAttack[];
  handChordRoll: {
    direction: 'ASCENDING';
    offsetsBeatByAscendingPitchRank: readonly number[];
    measuredSpreadBeat: number;
  };
  sourceContract: {
    ppq: 480;
    measuredAttackGroups: 24;
    harmonyExcluded: true;
    literalPitchExcluded: true;
    cc64Present: false;
  };
};

/**
 * Generalized temporal/dynamic data only. The reference's literal pitches,
 * chord progression, track name and song identity are intentionally absent.
 */
export const CITY_TYPE1_GROOVE: CityType1GrooveAsset = {
  id: 'city.type1.v1',
  cycleBeats: 4,
  attacks: [
    {
      onsetBeat: 0.008333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 0.260417,
      relativeVelocity: 1.0475,
      accent: 'STRONG',
    },
    {
      onsetBeat: 0.508333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 0.010417,
      relativeVelocity: 1.0393,
      accent: 'STRONG',
    },
    {
      onsetBeat: 0.758333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 0.260417,
      relativeVelocity: 1.0516,
      accent: 'STRONG',
    },
    {
      onsetBeat: 1.258333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 0.260417,
      relativeVelocity: 1.0558,
      accent: 'STRONG',
    },
    {
      onsetBeat: 1.758333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 0.010417,
      relativeVelocity: 0.75,
      accent: 'WEAK',
    },
    {
      onsetBeat: 2.008333,
      durationBeat: 0.227083,
      gapToNextAttackBeat: 1.760417,
      relativeVelocity: 1.0558,
      accent: 'STRONG',
    },
  ],
  handChordRoll: {
    direction: 'ASCENDING',
    offsetsBeatByAscendingPitchRank: [0, 0.00625, 0.0125],
    measuredSpreadBeat: 0.0125,
  },
  sourceContract: {
    ppq: 480,
    measuredAttackGroups: 24,
    harmonyExcluded: true,
    literalPitchExcluded: true,
    cc64Present: false,
  },
};

type CityCandidatePolicy = {
  masks: readonly VoicingMask[];
  useHandChordRoll: boolean;
};

export const CITY_TYPE1_CANDIDATE_POLICIES: Record<CityType1CandidateId, CityCandidatePolicy> = {
  A_FULL: {
    masks: ['FULL', 'FULL', 'FULL', 'FULL', 'FULL', 'FULL'],
    useHandChordRoll: false,
  },
  B_SUBTRACTIVE: {
    masks: ['FULL', 'TRIAD', 'SHELL', 'TRIAD', 'ROOT_ONLY', 'FULL'],
    useHandChordRoll: false,
  },
  C_SUBTRACTIVE_ROLL: {
    masks: ['FULL', 'TRIAD', 'SHELL', 'TRIAD', 'ROOT_ONLY', 'FULL'],
    useHandChordRoll: true,
  },
};
