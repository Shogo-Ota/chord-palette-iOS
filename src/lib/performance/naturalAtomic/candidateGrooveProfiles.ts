import type { NaturalAttackVoicingSelection } from './attackVoicingPolicy';
import type { NaturalAttackVelocityShape } from './attackVelocityPolicy';

export type CandidateNaturalVariantId =
  'natural.type2' | 'natural.type3' | 'natural.type4' | 'natural.type5';

export type CandidateGrooveAttackSpec = {
  onsetBeat: number;
  durationBeat: number;
  velocity: number;
  selection: NaturalAttackVoicingSelection;
  velocityShape?: NaturalAttackVelocityShape;
};

export type CandidatePedalSpec = {
  onsetBeat: number;
  value: number;
};

export type CandidateGrooveProfile = {
  id: CandidateNaturalVariantId;
  sourceCandidateId:
    'STYLE_CANDIDATE_01' | 'STYLE_CANDIDATE_02' | 'STYLE_CANDIDATE_03' | 'STYLE_CANDIDATE_04';
  bars: readonly (readonly CandidateGrooveAttackSpec[])[];
  /**
   * Candidate files contain pedal, but the first production candidate keeps
   * authored key silence intact. A reduced CC64 envelope can be promoted only
   * after the rest and playback-fidelity gates pass.
   */
  pedalByBar: readonly (readonly CandidatePedalSpec[])[];
};

const mask = (value: 'FULL' | 'TRIAD' | 'SHELL' | 'RIGHT_HAND') =>
  ({ kind: 'MASK', mask: value }) as const;
const voice = (role: 'BASS' | 'RH_BOTTOM' | 'RH_MIDDLE' | 'RH_TOP') =>
  ({ kind: 'VOICE_ROLE', role }) as const;

const TYPE2_A: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.5, velocity: 94, selection: mask('FULL') },
  { onsetBeat: 1, durationBeat: 0.5, velocity: 86, selection: mask('RIGHT_HAND') },
  { onsetBeat: 1.5, durationBeat: 0.5, velocity: 78, selection: voice('BASS') },
  { onsetBeat: 2, durationBeat: 0.5, velocity: 92, selection: mask('FULL') },
  { onsetBeat: 3, durationBeat: 0.5, velocity: 84, selection: mask('RIGHT_HAND') },
  { onsetBeat: 3.5, durationBeat: 0.5, velocity: 76, selection: voice('BASS') },
];

const TYPE2_B: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.5, velocity: 92, selection: mask('FULL') },
  { onsetBeat: 1, durationBeat: 0.5, velocity: 84, selection: mask('RIGHT_HAND') },
  { onsetBeat: 1.5, durationBeat: 0.5, velocity: 76, selection: voice('BASS') },
  { onsetBeat: 2, durationBeat: 0.5, velocity: 94, selection: mask('FULL') },
  { onsetBeat: 3, durationBeat: 0.5, velocity: 82, selection: mask('RIGHT_HAND') },
  { onsetBeat: 3.5, durationBeat: 0.5, velocity: 74, selection: voice('BASS') },
];

const TYPE2_PEDAL: readonly CandidatePedalSpec[] = [
  { onsetBeat: 0, value: 96 },
  { onsetBeat: 3.9, value: 0 },
];

const TYPE3_A: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.62, velocity: 96, selection: mask('FULL') },
  { onsetBeat: 0.75, durationBeat: 0.18, velocity: 72, selection: mask('RIGHT_HAND') },
  { onsetBeat: 0.98, durationBeat: 0.25, velocity: 84, selection: voice('BASS') },
  { onsetBeat: 1.5, durationBeat: 0.31, velocity: 90, selection: mask('RIGHT_HAND') },
  { onsetBeat: 2.25, durationBeat: 0.16, velocity: 68, selection: voice('BASS') },
  { onsetBeat: 2.5, durationBeat: 0.44, velocity: 94, selection: mask('FULL') },
  { onsetBeat: 3, durationBeat: 0.22, velocity: 86, selection: voice('BASS') },
  { onsetBeat: 3.25, durationBeat: 0.21, velocity: 90, selection: mask('RIGHT_HAND') },
  { onsetBeat: 3.75, durationBeat: 0.22, velocity: 76, selection: voice('BASS') },
];

const TYPE3_B: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.79, velocity: 98, selection: mask('FULL') },
  { onsetBeat: 1, durationBeat: 0.64, velocity: 82, selection: voice('BASS') },
  { onsetBeat: 1.5, durationBeat: 0.31, velocity: 90, selection: mask('RIGHT_HAND') },
  { onsetBeat: 2, durationBeat: 0.19, velocity: 84, selection: voice('BASS') },
  { onsetBeat: 2.25, durationBeat: 0.13, velocity: 66, selection: voice('BASS') },
  { onsetBeat: 2.5, durationBeat: 0.44, velocity: 94, selection: mask('FULL') },
  { onsetBeat: 3, durationBeat: 0.22, velocity: 88, selection: voice('BASS') },
  { onsetBeat: 3.25, durationBeat: 0.21, velocity: 90, selection: mask('RIGHT_HAND') },
  { onsetBeat: 3.75, durationBeat: 0.23, velocity: 74, selection: voice('BASS') },
];

const TYPE3_D: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.61, velocity: 96, selection: mask('FULL') },
  { onsetBeat: 1, durationBeat: 0.25, velocity: 84, selection: voice('BASS') },
  { onsetBeat: 1.25, durationBeat: 0.24, velocity: 82, selection: voice('BASS') },
  { onsetBeat: 1.5, durationBeat: 0.5, velocity: 88, selection: mask('RIGHT_HAND') },
  { onsetBeat: 1.75, durationBeat: 0.18, velocity: 76, selection: voice('BASS') },
  { onsetBeat: 2.5, durationBeat: 0.44, velocity: 94, selection: mask('FULL') },
  { onsetBeat: 3, durationBeat: 0.24, velocity: 86, selection: voice('BASS') },
  { onsetBeat: 3.5, durationBeat: 0.3, velocity: 82, selection: mask('RIGHT_HAND') },
];

const TYPE4_A: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.56, velocity: 100, selection: mask('FULL') },
  { onsetBeat: 0.5, durationBeat: 0.62, velocity: 94, selection: voice('BASS') },
  { onsetBeat: 1, durationBeat: 0.33, velocity: 92, selection: mask('RIGHT_HAND') },
  { onsetBeat: 1.25, durationBeat: 0.2, velocity: 72, selection: voice('BASS') },
  { onsetBeat: 1.5, durationBeat: 0.18, velocity: 70, selection: voice('RH_BOTTOM') },
  { onsetBeat: 1.75, durationBeat: 0.16, velocity: 68, selection: voice('RH_TOP') },
  { onsetBeat: 2, durationBeat: 0.54, velocity: 98, selection: mask('FULL') },
  { onsetBeat: 2.5, durationBeat: 0.6, velocity: 92, selection: voice('BASS') },
  { onsetBeat: 3, durationBeat: 0.33, velocity: 90, selection: mask('RIGHT_HAND') },
  { onsetBeat: 3.25, durationBeat: 0.2, velocity: 74, selection: voice('BASS') },
  { onsetBeat: 3.5, durationBeat: 0.2, velocity: 70, selection: voice('RH_MIDDLE') },
  { onsetBeat: 3.75, durationBeat: 0.16, velocity: 68, selection: voice('RH_TOP') },
];

const TYPE4_B: readonly CandidateGrooveAttackSpec[] = TYPE4_A.map((attack, index) => ({
  ...attack,
  durationBeat:
    index === 0 || index === 6
      ? attack.durationBeat + 0.08
      : Math.max(0.12, attack.durationBeat - 0.02),
  velocity: index < 6 ? attack.velocity - 2 : attack.velocity,
}));

const TYPE4_D: readonly CandidateGrooveAttackSpec[] = TYPE4_A.filter(
  (attack) => attack.onsetBeat !== 1.25 && attack.onsetBeat !== 3.25,
).map((attack) => ({
  ...attack,
  velocity: attack.onsetBeat >= 3 ? attack.velocity + 2 : attack.velocity,
}));

const TYPE4_PEDAL: readonly CandidatePedalSpec[] = [
  { onsetBeat: 0, value: 92 },
  { onsetBeat: 0.82, value: 0 },
  { onsetBeat: 1, value: 92 },
  { onsetBeat: 1.95, value: 0 },
  { onsetBeat: 2, value: 92 },
  { onsetBeat: 2.82, value: 0 },
  { onsetBeat: 3, value: 92 },
  { onsetBeat: 3.95, value: 0 },
];

const TYPE5_A: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 1.45, velocity: 96, selection: voice('BASS') },
  { onsetBeat: 0.5, durationBeat: 0.96, velocity: 84, selection: voice('RH_BOTTOM') },
  { onsetBeat: 1, durationBeat: 0.59, velocity: 84, selection: voice('RH_MIDDLE') },
  { onsetBeat: 1.5, durationBeat: 0.26, velocity: 84, selection: voice('RH_TOP') },
  { onsetBeat: 2.5, durationBeat: 1.15, velocity: 82, selection: voice('RH_MIDDLE') },
  { onsetBeat: 3, durationBeat: 0.62, velocity: 80, selection: voice('RH_BOTTOM') },
  { onsetBeat: 3.5, durationBeat: 0.39, velocity: 86, selection: voice('BASS') },
];

const TYPE5_B: readonly CandidateGrooveAttackSpec[] = TYPE5_A.map((attack) => ({
  ...attack,
  durationBeat:
    attack.onsetBeat === 0
      ? Math.max(1.1, attack.durationBeat - 0.2)
      : attack.durationBeat + ([1.5, 3.5].includes(attack.onsetBeat) ? 0.1 : 0.04),
  velocity: attack.velocity - ([0.5, 2.5].includes(attack.onsetBeat) ? 4 : 2),
}));

const TYPE5_PEDAL: readonly CandidatePedalSpec[] = [
  { onsetBeat: 0, value: 96 },
  { onsetBeat: 3.9, value: 0 },
];

export const CANDIDATE_GROOVE_PROFILES: Readonly<
  Record<CandidateNaturalVariantId, CandidateGrooveProfile>
> = {
  'natural.type2': {
    id: 'natural.type2',
    sourceCandidateId: 'STYLE_CANDIDATE_01',
    bars: [TYPE2_A, TYPE2_B, TYPE2_A, TYPE2_B],
    pedalByBar: [TYPE2_PEDAL, TYPE2_PEDAL, TYPE2_PEDAL, TYPE2_PEDAL],
  },
  'natural.type3': {
    id: 'natural.type3',
    sourceCandidateId: 'STYLE_CANDIDATE_02',
    bars: [TYPE3_A, TYPE3_B, TYPE3_A, TYPE3_D],
    pedalByBar: [[], [], [], []],
  },
  'natural.type4': {
    id: 'natural.type4',
    sourceCandidateId: 'STYLE_CANDIDATE_03',
    bars: [TYPE4_A, TYPE4_B, TYPE4_A, TYPE4_D],
    pedalByBar: [TYPE4_PEDAL, TYPE4_PEDAL, TYPE4_PEDAL, TYPE4_PEDAL],
  },
  'natural.type5': {
    id: 'natural.type5',
    sourceCandidateId: 'STYLE_CANDIDATE_04',
    bars: [TYPE5_A, TYPE5_B, TYPE5_A, TYPE5_B],
    pedalByBar: [TYPE5_PEDAL, TYPE5_PEDAL, TYPE5_PEDAL, TYPE5_PEDAL],
  },
};
