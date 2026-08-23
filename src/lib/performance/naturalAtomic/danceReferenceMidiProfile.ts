import type { NaturalAttackVelocityShape } from './attackVelocityPolicy';
import type { NaturalVoiceRole } from './attackVoicingPolicy';
import type { CandidateGrooveAttackSpec, CandidatePedalSpec } from './candidateGrooveProfiles';

export const DANCE_VARIANT_ID = 'natural.dance1' as const;

const mask = (value: 'FULL' | 'RIGHT_HAND') => ({ kind: 'MASK', mask: value }) as const;
const voice = (role: NaturalVoiceRole) => ({ kind: 'VOICE_ROLE', role }) as const;
const voices = (...roles: readonly NaturalVoiceRole[]) => ({ kind: 'VOICE_ROLES', roles }) as const;
const velocityShape = (
  rightByAscendingRank: readonly number[],
  left?: number,
): NaturalAttackVelocityShape => ({ left, rightByAscendingRank });

type DanceBarEnvelope = {
  downbeatLeft: number;
  downbeatRight: readonly number[];
  right: readonly number[];
  pairLeft: number;
  pairRight: number;
};

function measuredDanceBar(envelope: DanceBarEnvelope): readonly CandidateGrooveAttackSpec[] {
  return [
    {
      onsetBeat: 0,
      durationBeat: 1,
      velocity: 85,
      selection: mask('FULL'),
      velocityShape: velocityShape(envelope.downbeatRight, envelope.downbeatLeft),
    },
    {
      onsetBeat: 1,
      durationBeat: 0.5,
      velocity: 84,
      selection: mask('RIGHT_HAND'),
      velocityShape: velocityShape(envelope.right),
    },
    {
      onsetBeat: 1.5,
      durationBeat: 1,
      velocity: 84,
      selection: voices('BASS', 'RH_BOTTOM'),
      velocityShape: velocityShape([envelope.pairRight], envelope.pairLeft),
    },
    {
      onsetBeat: 1.75,
      durationBeat: 0.5,
      velocity: 84,
      selection: mask('RIGHT_HAND'),
      velocityShape: velocityShape(envelope.right),
    },
    {
      onsetBeat: 2.5,
      durationBeat: 1,
      velocity: 84,
      selection: mask('RIGHT_HAND'),
      velocityShape: velocityShape(envelope.right),
    },
    {
      onsetBeat: 3.5,
      durationBeat: 0.5,
      velocity: 84,
      selection: mask('RIGHT_HAND'),
      velocityShape: velocityShape(envelope.right),
    },
  ];
}

const DANCE_BAR_1 = measuredDanceBar({
  downbeatLeft: 85,
  downbeatRight: [87, 92, 102],
  right: [77, 81, 93],
  pairLeft: 84,
  pairRight: 84,
});

const DANCE_BAR_2 = measuredDanceBar({
  downbeatLeft: 88,
  downbeatRight: [77, 85, 97],
  right: [77, 85, 97],
  pairLeft: 86,
  pairRight: 86,
});

const DANCE_BAR_3 = measuredDanceBar({
  downbeatLeft: 83,
  downbeatRight: [80, 77, 97, 81],
  right: [80, 77, 97, 81],
  pairLeft: 75,
  pairRight: 78,
});

const DANCE_BAR_4 = measuredDanceBar({
  downbeatLeft: 83,
  downbeatRight: [80, 77, 97, 81],
  right: [80, 77, 97, 81],
  pairLeft: 75,
  pairRight: 78,
});

const DANCE_BAR_5 = measuredDanceBar({
  downbeatLeft: 83,
  downbeatRight: [80, 84, 93],
  right: [77, 81, 93],
  pairLeft: 84,
  pairRight: 84,
});

const DANCE_BAR_6 = measuredDanceBar({
  downbeatLeft: 88,
  downbeatRight: [77, 85, 97],
  right: [77, 85, 97],
  pairLeft: 86,
  pairRight: 86,
});

const DANCE_BAR_7_DROPOUT: readonly CandidateGrooveAttackSpec[] = [
  {
    onsetBeat: 0,
    durationBeat: 1,
    velocity: 84,
    selection: mask('FULL'),
    velocityShape: velocityShape([80, 77, 97, 81], 88),
  },
  {
    onsetBeat: 1,
    durationBeat: 0.5,
    velocity: 84,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([80, 77, 97, 81]),
  },
  {
    onsetBeat: 1.75,
    durationBeat: 0.5,
    velocity: 84,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([80, 77, 97, 81]),
  },
  {
    onsetBeat: 2.5,
    durationBeat: 1,
    velocity: 84,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([80, 77, 97, 81]),
  },
  {
    onsetBeat: 3.5,
    durationBeat: 0.5,
    velocity: 84,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([80, 77, 97, 81]),
  },
];

const DANCE_BAR_8_ROLL_FILL: readonly CandidateGrooveAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 1, velocity: 88, selection: voice('BASS') },
  {
    onsetBeat: 0.0438,
    durationBeat: 0.875,
    velocity: 85,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([77, 80, 97]),
  },
  {
    onsetBeat: 1,
    durationBeat: 0.5,
    velocity: 85,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([77, 80, 97]),
  },
  {
    onsetBeat: 1.75,
    durationBeat: 0.5,
    velocity: 85,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([77, 80, 97]),
  },
  {
    onsetBeat: 2.5,
    durationBeat: 0.5,
    velocity: 85,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([77, 80, 97]),
  },
  { onsetBeat: 3, durationBeat: 1, velocity: 80, selection: voice('BASS') },
  {
    onsetBeat: 3,
    durationBeat: 0.5,
    velocity: 85,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([77, 80, 97]),
  },
  {
    onsetBeat: 3.5,
    durationBeat: 0.5,
    velocity: 92,
    selection: mask('RIGHT_HAND'),
    velocityShape: velocityShape([92, 92, 92]),
  },
];

const NO_PEDAL: readonly CandidatePedalSpec[] = [];

/**
 * Pitch-independent reduction of `hipnotize piano.mid` (SHA-256 ee9dd75b…).
 *
 * Its six-attack syncopation and block texture intersect with the Reo Funk
 * corpus, while the eighth-bar roll/fill is absent from the current UI Funk.
 * Pitch, key, chord identity and progression are deliberately not stored.
 */
export const DANCE_REFERENCE_MIDI_PROFILE = {
  id: DANCE_VARIANT_ID,
  sourceCandidateId: 'DANCE_MIDI_EE9DD75B_REO_FUNK_INTERSECTION',
  bars: [
    DANCE_BAR_1,
    DANCE_BAR_2,
    DANCE_BAR_3,
    DANCE_BAR_4,
    DANCE_BAR_5,
    DANCE_BAR_6,
    DANCE_BAR_7_DROPOUT,
    DANCE_BAR_8_ROLL_FILL,
  ],
  pedalByBar: [NO_PEDAL, NO_PEDAL, NO_PEDAL, NO_PEDAL, NO_PEDAL, NO_PEDAL, NO_PEDAL, NO_PEDAL],
} as const;
