import type { ChordHarmonyInput } from '../strictV2';
import type { HarmonicDegree } from '../humanTemplate/degreeRoles';

export const VOICING_POSITIONS = ['root', 'first', 'second'] as const;

/**
 * User-facing inversion preference. Slash bass always wins over this preference.
 */
export type VoicingPosition = (typeof VOICING_POSITIONS)[number];

export type BaseVoicingPreference = {
  position: VoicingPosition;
  /** Whole-register shift in octaves. */
  octaveShift: number;
};

export const DEFAULT_BASE_VOICING_PREFERENCE: BaseVoicingPreference = {
  position: 'root',
  octaveShift: 0,
};

export type BaseVoicingHand = 'LH' | 'RH';

export type BaseVoicingNote = {
  pitch: number;
  pc: number;
  interval: number;
  degree: HarmonicDegree;
  hand: BaseVoicingHand;
  isBass: boolean;
  isDuplicate: boolean;
};

/**
 * Style-neutral harmonic material. Rhythm providers may only remove notes from
 * this voicing; they must never move or add pitches.
 */
export type BaseVoicing = {
  chordIndex: number;
  harmony: ChordHarmonyInput;
  preference: BaseVoicingPreference;
  notes: BaseVoicingNote[];
};

export type BaseVoicingCandidate = {
  notes: BaseVoicingNote[];
  staticCost: number;
};
