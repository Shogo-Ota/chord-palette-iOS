/**
 * Groove MIDI Dataset drum pitch mapping (Magenta GMD docs).
 *
 * Roland TD-11 pitches differ from GM; the paper's simplified mapping collapses
 * them into kick / snare / hats / toms / crash / ride for analysis.
 */

export type GmdVoice =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'tomHigh'
  | 'tomMid'
  | 'tomLow'
  | 'crash'
  | 'ride'
  | 'other';

/** Paper mapping: Roland pitch → simplified voice. */
const PAPER_VOICE: Readonly<Record<number, GmdVoice>> = {
  36: 'kick',
  38: 'snare',
  40: 'snare',
  37: 'snare',
  48: 'tomHigh',
  50: 'tomHigh',
  45: 'tomMid',
  47: 'tomMid',
  43: 'tomLow',
  58: 'tomLow',
  46: 'hatOpen',
  26: 'hatOpen',
  42: 'hatClosed',
  22: 'hatClosed',
  44: 'hatClosed',
  49: 'crash',
  55: 'crash',
  57: 'crash',
  52: 'crash',
  51: 'ride',
  59: 'ride',
  53: 'ride',
};

export function gmdVoiceOf(pitch: number): GmdVoice {
  return PAPER_VOICE[pitch] ?? 'other';
}

/** Voices used for Chord Palette kit Humanize (kick / snare / hats). */
export const CORE_GMD_VOICES: readonly GmdVoice[] = ['kick', 'snare', 'hatClosed', 'hatOpen'];
