import type { Preset } from '@/types';

/**
 * Sample progression presets for tests ONLY (kept OUT of `__tests__/` so Jest's
 * default testMatch doesn't treat it as a suite). The shipped catalog
 * (`src/data/presets.ts`) is intentionally empty (user-curated), so tests that
 * exercise transposition / voicing / performance across representative progressions
 * keep their own fixtures here. Not imported by any app code ⇒ tree-shaken out.
 */
export const SAMPLE_PRESETS: Preset[] = [
  {
    id: 'jpop-royal',
    name: 'J-POP王道進行',
    category: 'free',
    chordsDisplay: 'F · G · Em · Am',
    tags: ['明るい', '王道', 'サビ向き'],
    accent: '#eab308',
    // 王道進行 (4536): IV - V - iii - vi
    chords: [
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 4, suffix: 'm', function: 'tonic', degreeLabel: 'iii', durationBeats: 4 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
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
];
