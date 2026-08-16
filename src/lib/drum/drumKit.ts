/**
 * Domain-side mirror of `modules/chord-audio/ios/DrumKit.swift`.
 * Used for MIDI export drum track generation — keep in sync with native hits.
 */

export type DrumVoice =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'ride'
  | 'rim'
  | 'clap';

export type DrumHit = {
  beat: number;
  voice: DrumVoice;
  vel: number;
};

const GROOVE_IDS = [
  'pop8',
  'pop8-min',
  'pop16',
  'rock8',
  'rock16',
  'soul16',
  'clap',
  'bossaNova',
  'shuffle',
  'swing',
  'reggae',
  'sixEight',
  'waltz',
  'beat4',
] as const;

function hats(
  voice: DrumVoice,
  step: number,
  vel: number,
  accent: number,
  barLength = 4,
): DrumHit[] {
  const out: DrumHit[] = [];
  let b = 0;
  while (b < barLength - 1e-9) {
    const slot = Math.round(b * 4) % 4;
    let hitVel: number;
    if (slot === 0) hitVel = accent;
    else if (slot === 2) hitVel = vel * 0.72;
    else hitVel = vel * 0.55;
    out.push({ beat: b, voice, vel: hitVel });
    b += step;
  }
  return out;
}

function swungHats(
  voice: DrumVoice,
  barLength = 4,
  vel: number,
  accent: number,
): DrumHit[] {
  const out: DrumHit[] = [];
  let beat = 0;
  while (beat < barLength - 1e-9) {
    out.push({ beat, voice, vel: accent });
    const off = beat + 2 / 3;
    if (off < barLength - 1e-9) out.push({ beat: off, voice, vel });
    beat += 1;
  }
  return out;
}

function hitsForGroove(groove: string): DrumHit[] {
  switch (groove) {
    case 'pop8':
    case 'pop8-min':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...hats('hatClosed', 0.5, 0.45, 0.6, 4),
      ];
    case 'beat4':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...hats('hatClosed', 1.0, 0.44, 0.58, 4),
      ];
    case 'pop16':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 2.5, voice: 'kick', vel: 0.5 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...hats('hatClosed', 0.25, 0.4, 0.58, 4),
      ];
    case 'rock8':
      return [
        { beat: 0, voice: 'kick', vel: 1.0 },
        { beat: 2, voice: 'kick', vel: 0.95 },
        { beat: 1, voice: 'snare', vel: 0.98 },
        { beat: 3, voice: 'snare', vel: 0.98 },
        ...hats('hatClosed', 0.5, 0.6, 0.72, 4),
      ];
    case 'rock16':
      return [
        { beat: 0, voice: 'kick', vel: 1.0 },
        { beat: 1.5, voice: 'kick', vel: 0.7 },
        { beat: 2, voice: 'kick', vel: 0.95 },
        { beat: 1, voice: 'snare', vel: 0.98 },
        { beat: 3, voice: 'snare', vel: 0.98 },
        ...hats('hatClosed', 0.25, 0.52, 0.66, 4),
      ];
    case 'soul16':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2.5, voice: 'kick', vel: 0.72 },
        { beat: 1, voice: 'snare', vel: 0.95 },
        { beat: 3, voice: 'snare', vel: 0.95 },
        { beat: 1.75, voice: 'snare', vel: 0.3 },
        { beat: 3.75, voice: 'snare', vel: 0.3 },
        ...hats('hatClosed', 0.25, 0.4, 0.55, 4),
      ];
    case 'clap':
      return [
        { beat: 1, voice: 'clap', vel: 1.0 },
        { beat: 3, voice: 'clap', vel: 1.0 },
      ];
    case 'bossaNova':
      return [
        { beat: 0, voice: 'kick', vel: 0.72 },
        { beat: 1.5, voice: 'kick', vel: 0.6 },
        { beat: 2, voice: 'kick', vel: 0.72 },
        { beat: 3.5, voice: 'kick', vel: 0.6 },
        { beat: 0, voice: 'rim', vel: 0.72 },
        { beat: 1.5, voice: 'rim', vel: 0.62 },
        { beat: 2.5, voice: 'rim', vel: 0.66 },
        { beat: 3, voice: 'rim', vel: 0.6 },
        ...hats('hatClosed', 0.5, 0.32, 0.42, 4),
      ];
    case 'shuffle':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...swungHats('hatClosed', 4, 0.42, 0.58),
      ];
    case 'swing':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...swungHats('ride', 4, 0.38, 0.52),
      ];
    case 'reggae':
      return [
        { beat: 0, voice: 'kick', vel: 0.82 },
        { beat: 2, voice: 'kick', vel: 0.78 },
        { beat: 1, voice: 'rim', vel: 0.88 },
        { beat: 3, voice: 'rim', vel: 0.88 },
        { beat: 0.5, voice: 'hatClosed', vel: 0.28 },
        { beat: 1.5, voice: 'hatClosed', vel: 0.26 },
        { beat: 2.5, voice: 'hatClosed', vel: 0.28 },
        { beat: 3.5, voice: 'hatClosed', vel: 0.26 },
      ];
    case 'sixEight':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 3, voice: 'kick', vel: 0.82 },
        { beat: 3, voice: 'snare', vel: 0.55 },
        ...hats('hatClosed', 1.0, 0.38, 0.48, 6),
      ];
    case 'waltz':
      return [
        { beat: 0, voice: 'kick', vel: 0.88 },
        { beat: 1, voice: 'snare', vel: 0.52 },
        { beat: 2, voice: 'snare', vel: 0.48 },
        { beat: 1, voice: 'hatClosed', vel: 0.36 },
        { beat: 2, voice: 'hatClosed', vel: 0.32 },
      ];
    default:
      return hitsForGroove('pop8');
  }
}

/** General MIDI percussion note for a drum voice (standard kit). */
export function gmDrumNote(voice: DrumVoice): number {
  switch (voice) {
    case 'kick':
      return 36;
    case 'snare':
      return 38;
    case 'hatClosed':
      return 42;
    case 'hatOpen':
      return 46;
    case 'ride':
      return 51;
    case 'rim':
      return 37;
    case 'clap':
      return 39;
  }
}

/** One-bar hit list for a groove id (mirrors DrumKit.hits(for:)). */
export function drumHitsForGroove(grooveId: string): DrumHit[] {
  return hitsForGroove(grooveId);
}

/** Bar length in beats for meter-specific grooves. */
export function drumBarLengthForGroove(grooveId: string): number {
  if (grooveId === 'sixEight') return 6;
  if (grooveId === 'waltz') return 3;
  return 4;
}

export const DRUM_GROOVE_IDS = GROOVE_IDS;
