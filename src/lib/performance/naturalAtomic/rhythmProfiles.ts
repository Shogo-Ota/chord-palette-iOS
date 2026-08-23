import type { NaturalAttackVoicingSelection } from './attackVoicingPolicy';
import type { NaturalAttackVelocityShape } from './attackVelocityPolicy';
import { GROOVE_PROFILE_REGISTRY, type ProfileGrooveVariantId } from './grooveProfileRegistry';

export type NaturalRhythmAttackSpec = {
  onsetBeat: number;
  durationBeat: number;
  velocity: number;
  selection?: NaturalAttackVoicingSelection;
  velocityShape?: NaturalAttackVelocityShape;
};

export type NaturalRhythmVariantId = 'natural.type1' | ProfileGrooveVariantId;
export type NaturalPedalPolicy = 'TEMPLATE' | 'CANDIDATE' | 'NONE';

export type NaturalRhythmStrategy = {
  id: NaturalRhythmVariantId;
  attacksForBar: (barInPhrase: number) => readonly NaturalRhythmAttackSpec[];
  /** Fixed subtractive mask; omitted means the adaptive Natural mask policy. */
  attackMask?: 'RIGHT_HAND';
  /** Keep the Shared Base LH note sounding independently under RH attacks. */
  sustainBass: boolean;
  /** Selects the single CC64 authority for live playback and every export path. */
  pedalPolicy: NaturalPedalPolicy;
};

const TYPE1: readonly NaturalRhythmAttackSpec[] = [
  { onsetBeat: 0, durationBeat: 0.78, velocity: 96 },
  { onsetBeat: 1, durationBeat: 0.28, velocity: 78 },
  { onsetBeat: 1.5, durationBeat: 0.78, velocity: 90 },
  { onsetBeat: 2.5, durationBeat: 0.28, velocity: 76 },
  { onsetBeat: 3, durationBeat: 0.78, velocity: 86 },
];

const STRATEGIES: Readonly<Record<NaturalRhythmStrategy['id'], NaturalRhythmStrategy>> = {
  'natural.type1': {
    id: 'natural.type1',
    attacksForBar: () => TYPE1,
    sustainBass: false,
    pedalPolicy: 'TEMPLATE',
  },
  'natural.type2': {
    id: 'natural.type2',
    attacksForBar: (barInPhrase) => GROOVE_PROFILE_REGISTRY['natural.type2'].bars[barInPhrase % 4]!,
    sustainBass: false,
    pedalPolicy: 'CANDIDATE',
  },
  'natural.type3': {
    id: 'natural.type3',
    attacksForBar: (barInPhrase) => GROOVE_PROFILE_REGISTRY['natural.type3'].bars[barInPhrase % 4]!,
    sustainBass: false,
    pedalPolicy: 'NONE',
  },
  'natural.type4': {
    id: 'natural.type4',
    attacksForBar: (barInPhrase) => GROOVE_PROFILE_REGISTRY['natural.type4'].bars[barInPhrase % 4]!,
    sustainBass: false,
    pedalPolicy: 'CANDIDATE',
  },
  'natural.type5': {
    id: 'natural.type5',
    attacksForBar: (barInPhrase) => GROOVE_PROFILE_REGISTRY['natural.type5'].bars[barInPhrase % 4]!,
    sustainBass: false,
    pedalPolicy: 'CANDIDATE',
  },
  'natural.dance1': {
    id: 'natural.dance1',
    attacksForBar: (barInPhrase) => {
      const profile = GROOVE_PROFILE_REGISTRY['natural.dance1'];
      return profile.bars[barInPhrase % profile.bars.length]!;
    },
    sustainBass: false,
    pedalPolicy: 'NONE',
  },
};

export function naturalRhythmStrategyFor(variantId: unknown): NaturalRhythmStrategy {
  return STRATEGIES[variantId as NaturalRhythmStrategy['id']] ?? STRATEGIES['natural.type1'];
}

/**
 * Preserve authored rhythm on short chords: take the prefix that fits and clip
 * only the final gate. A one- or two-beat chord is never a compressed four-beat bar.
 */
export function naturalRhythmForChord(
  strategy: NaturalRhythmStrategy,
  chordIndex: number,
  chordDurationBeats: number,
): NaturalRhythmAttackSpec[] {
  const duration = Math.max(0, chordDurationBeats);
  return strategy
    .attacksForBar(chordIndex)
    .filter((attack) => attack.onsetBeat < duration - 1e-9)
    .map((attack) => ({
      ...attack,
      durationBeat: Math.min(attack.durationBeat, duration - attack.onsetBeat),
    }))
    .filter((attack) => attack.durationBeat > 1e-9);
}
