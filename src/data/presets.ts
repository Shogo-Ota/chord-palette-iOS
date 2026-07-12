import type { Preset } from '@/types';

/**
 * Preset catalog (requirements §6). Chords are stored by *degree* (`offset`
 * semitones above the tonic + `suffix`), so a preset auto-transposes to the
 * current key via `buildPresetProgression` (see src/lib/presets.ts).
 * `chordsDisplay` is the C-major rendering used on the list for a quick preview.
 *
 * NOTE: song-derived preset names (e.g. "Just The Two of Us進行") are provisional
 * and must be reviewed for trademark/expression before App Store release.
 */
export const PRESETS: Preset[] = [
  {
    id: 'jpop-royal',
    name: 'J-POP王道進行',
    category: 'free',
    chordsDisplay: 'C · G · Am · F',
    tags: ['明るい', '王道', 'サビ向き'],
    accent: '#eab308',
    // I - V - vi - IV
    chords: [
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
    ],
  },
  {
    id: 'jpop-marusa',
    name: 'J-POP丸サ進行',
    category: 'pro',
    chordsDisplay: 'FM7 · E7 · Am7 · C7',
    tags: ['エモい', '浮遊感'],
    accent: '#d6409f',
    // IVmaj7 - III7 - vim7 - I7
    chords: [
      { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
      { offset: 4, suffix: '7', function: 'dominant', degreeLabel: 'III7', durationBeats: 4 },
      { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
      { offset: 0, suffix: '7', function: 'dominant', degreeLabel: 'I7', durationBeats: 4 },
    ],
  },
  {
    id: 'just-the-two',
    name: 'Just The Two of Us進行',
    category: 'pro',
    chordsDisplay: 'FM7 · E7 · Am7 · Gm7-C7',
    tags: ['おしゃれ', '都会的'],
    accent: '#3b82f6',
    // IVmaj7 - III7 - vim7 - vm7 - I7 (last two share a bar)
    chords: [
      { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
      { offset: 4, suffix: '7', function: 'dominant', degreeLabel: 'III7', durationBeats: 4 },
      { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
      { offset: 7, suffix: 'm7', function: 'dominant', degreeLabel: 'vm7', durationBeats: 2 },
      { offset: 0, suffix: '7', function: 'dominant', degreeLabel: 'I7', durationBeats: 2 },
    ],
  },
  {
    id: 'pop-punk',
    name: 'Pop Punk進行',
    category: 'pro',
    chordsDisplay: 'C · G · Am · F',
    tags: ['疾走感', 'ロック'],
    accent: '#ef4444',
    // I - V - vi - IV
    chords: [
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
    ],
  },
  {
    id: 'komuro',
    name: '小室進行',
    category: 'pro',
    chordsDisplay: 'Am · F · G · C',
    tags: ['切ない', 'ドラマチック'],
    accent: '#8b5cf6',
    // vi - IV - V - I
    chords: [
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
    ],
  },
  {
    id: 'city-pop',
    name: 'City Pop進行',
    category: 'pro',
    chordsDisplay: 'FM7 · G7 · Em7 · Am7',
    tags: ['爽やか', '夜景'],
    accent: '#22c55e',
    // IVmaj7 - V7 - iiim7 - vim7
    chords: [
      { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
      { offset: 7, suffix: '7', function: 'dominant', degreeLabel: 'V7', durationBeats: 4 },
      { offset: 4, suffix: 'm7', function: 'tonic', degreeLabel: 'iiim7', durationBeats: 4 },
      { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
    ],
  },
];
