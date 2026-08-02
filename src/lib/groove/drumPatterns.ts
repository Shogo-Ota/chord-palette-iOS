import type { DrumHit, DrumPatternDoc, DrumVoice } from '@/lib/groove/types';

function hats(voice: DrumVoice, step: number, vel: number, accent: number): DrumHit[] {
  const out: DrumHit[] = [];
  for (let b = 0; b < 4 - 1e-9; b += step) {
    const onDownbeat = Math.abs(Math.round(b) - b) < 1e-9;
    out.push({ beat: b, voice, vel: onDownbeat ? accent : vel });
  }
  return out;
}

function pattern(id: string): DrumHit[] {
  switch (id) {
    case 'pop8':
    case 'pop8-min':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...hats('hatClosed', 0.5, 0.45, 0.6),
      ];
    case 'pop16':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2, voice: 'kick', vel: 0.85 },
        { beat: 2.5, voice: 'kick', vel: 0.5 },
        { beat: 1, voice: 'snare', vel: 0.9 },
        { beat: 3, voice: 'snare', vel: 0.9 },
        ...hats('hatClosed', 0.25, 0.4, 0.58),
      ];
    case 'rock8':
      return [
        { beat: 0, voice: 'kick', vel: 1.0 },
        { beat: 2, voice: 'kick', vel: 0.95 },
        { beat: 1, voice: 'snare', vel: 0.98 },
        { beat: 3, voice: 'snare', vel: 0.98 },
        ...hats('hatClosed', 0.5, 0.6, 0.72),
      ];
    case 'rock16':
      return [
        { beat: 0, voice: 'kick', vel: 1.0 },
        { beat: 1.5, voice: 'kick', vel: 0.7 },
        { beat: 2, voice: 'kick', vel: 0.95 },
        { beat: 1, voice: 'snare', vel: 0.98 },
        { beat: 3, voice: 'snare', vel: 0.98 },
        ...hats('hatClosed', 0.25, 0.52, 0.66),
      ];
    case 'soul16':
      return [
        { beat: 0, voice: 'kick', vel: 0.9 },
        { beat: 2.5, voice: 'kick', vel: 0.72 },
        { beat: 1, voice: 'snare', vel: 0.95 },
        { beat: 3, voice: 'snare', vel: 0.95 },
        { beat: 1.75, voice: 'snare', vel: 0.3, tags: ['ghost'] },
        { beat: 3.75, voice: 'snare', vel: 0.3, tags: ['ghost'] },
        ...hats('hatClosed', 0.25, 0.4, 0.55),
      ];
    case 'jazzSwing':
      return [
        { beat: 0, voice: 'ride', vel: 0.7 },
        { beat: 1, voice: 'ride', vel: 0.66 },
        { beat: 1 + 2 / 3, voice: 'ride', vel: 0.5 },
        { beat: 2, voice: 'ride', vel: 0.7 },
        { beat: 3, voice: 'ride', vel: 0.66 },
        { beat: 3 + 2 / 3, voice: 'ride', vel: 0.5 },
        { beat: 1, voice: 'hatOpen', vel: 0.4 },
        { beat: 3, voice: 'hatOpen', vel: 0.4 },
        { beat: 0, voice: 'kick', vel: 0.22 },
        { beat: 1, voice: 'kick', vel: 0.2 },
        { beat: 2, voice: 'kick', vel: 0.22 },
        { beat: 3, voice: 'kick', vel: 0.2 },
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
        ...hats('hatClosed', 0.5, 0.32, 0.42),
      ];
    default:
      return pattern('pop8');
  }
}

const IDS = [
  'pop8',
  'pop8-min',
  'pop16',
  'rock8',
  'rock16',
  'soul16',
  'jazzSwing',
  'bossaNova',
] as const;

export const DRUM_PATTERNS: Record<string, DrumPatternDoc> = Object.fromEntries(
  IDS.map((id) => [id, { id, hits: pattern(id) }]),
);

export function getDrumPattern(id: string): DrumPatternDoc {
  return DRUM_PATTERNS[id] ?? DRUM_PATTERNS.pop8;
}
