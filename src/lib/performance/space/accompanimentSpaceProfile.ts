import type { AccompanimentVariantId } from '@/lib/performance/variants';

export type RoomReverbPreset = 'off' | 'smallRoom';

export type AccompanimentSpaceProfile = Readonly<{
  reverbPreset: RoomReverbPreset;
  /** AVAudioUnitReverb wet/dry percentage, constrained to 0–100. */
  reverbWetDryMix: number;
}>;

const DRY: AccompanimentSpaceProfile = {
  reverbPreset: 'off',
  reverbWetDryMix: 0,
};

const SUBTLE_SMALL_ROOM: AccompanimentSpaceProfile = {
  reverbPreset: 'smallRoom',
  reverbWetDryMix: 8,
};

const SPACE_BY_VARIANT: Readonly<Record<string, AccompanimentSpaceProfile>> = {
  'natural.type3': SUBTLE_SMALL_ROOM,
  'city.type1': SUBTLE_SMALL_ROOM,
};

/**
 * Playback-space policy is independent from MIDI generation.
 *
 * Styles own only a stable semantic profile. Native audio decides how the
 * declared room is rendered, while MIDI export remains effect-free.
 */
export function accompanimentSpaceProfileFor(
  variant: AccompanimentVariantId | null | undefined,
): AccompanimentSpaceProfile {
  return (variant && SPACE_BY_VARIANT[variant]) || DRY;
}
