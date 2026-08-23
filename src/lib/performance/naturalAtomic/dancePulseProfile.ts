import type { NaturalAttackVelocityShape } from './attackVelocityPolicy';
import type { CandidateGrooveAttackSpec, CandidatePedalSpec } from './candidateGrooveProfiles';

export const DANCE_VARIANT_ID = 'natural.dance1' as const;

const mask = (value: 'FULL' | 'RIGHT_HAND') => ({ kind: 'MASK', mask: value }) as const;
const voice = (role: 'BASS') => ({ kind: 'VOICE_ROLE', role }) as const;
const velocityShape = (
  rightByAscendingRank: readonly number[],
  left?: number,
): NaturalAttackVelocityShape => ({ left, rightByAscendingRank });

/**
 * Piano reduction of the measured full-mix pulse at 00:35–01:05.
 *
 * The source groove is driven by stable eighth-note role alternation: a chord
 * anchor on the beat and low energy on every "&". Pitch and harmony are not
 * stored; every selection is realized from the user's Shared Base Voicing.
 */
const DANCE_PULSE_A: readonly CandidateGrooveAttackSpec[] = [
  {
    onsetBeat: 0,
    durationBeat: 0.42,
    velocity: 96,
    selection: mask('FULL'),
    velocityShape: velocityShape([78, 88, 98], 88),
  },
  { onsetBeat: 0.5, durationBeat: 0.36, velocity: 88, selection: voice('BASS') },
  {
    onsetBeat: 1,
    durationBeat: 0.28,
    velocity: 82,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([70, 80, 90]),
  },
  { onsetBeat: 1.5, durationBeat: 0.36, velocity: 90, selection: voice('BASS') },
  {
    onsetBeat: 2,
    durationBeat: 0.42,
    velocity: 94,
    selection: mask('FULL'),
    velocityShape: velocityShape([76, 86, 96], 86),
  },
  { onsetBeat: 2.5, durationBeat: 0.36, velocity: 92, selection: voice('BASS') },
  {
    onsetBeat: 3,
    durationBeat: 0.28,
    velocity: 84,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([72, 82, 92]),
  },
  { onsetBeat: 3.5, durationBeat: 0.34, velocity: 88, selection: voice('BASS') },
];

const DANCE_PULSE_B: readonly CandidateGrooveAttackSpec[] = DANCE_PULSE_A.map((attack) => {
  if (attack.onsetBeat === 0) {
    return {
      ...attack,
      velocity: 98,
      velocityShape: velocityShape([80, 90, 100], 90),
    };
  }
  if (attack.onsetBeat === 3.5) {
    return { ...attack, velocity: 94 };
  }
  return attack;
});

const DANCE_PULSE_PEDAL: readonly CandidatePedalSpec[] = [
  { onsetBeat: 0, value: 84 },
  { onsetBeat: 0.44, value: 0 },
  { onsetBeat: 2, value: 84 },
  { onsetBeat: 2.44, value: 0 },
];

export const DANCE_PULSE_PROFILE = {
  id: DANCE_VARIANT_ID,
  sourceCandidateId: 'DANCE_AUDIO_REFERENCE_0035_0105',
  bars: [DANCE_PULSE_A, DANCE_PULSE_B, DANCE_PULSE_A, DANCE_PULSE_B],
  pedalByBar: [DANCE_PULSE_PEDAL, DANCE_PULSE_PEDAL, DANCE_PULSE_PEDAL, DANCE_PULSE_PEDAL],
} as const;
