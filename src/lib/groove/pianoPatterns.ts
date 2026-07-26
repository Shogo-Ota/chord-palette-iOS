import type { CompStroke, PianoPatternDoc } from '@/lib/groove/types';
import type { AccompanimentPattern } from '@/types';

/**
 * GT-001 calibrated 16th body (Accent.md):
 * downbeat ~0.59, & ~0.56, e/a ~0.55 with softer "e".
 */
function body16Strokes(): CompStroke[] {
  const out: CompStroke[] = [];
  for (let sixteenth = 0; sixteenth < 4 - 1e-9; sixteenth += 0.25) {
    const slot = Math.round(sixteenth * 4) % 4; // 0=↓ 1=e 2=& 3=a
    if (slot === 0) out.push({ beat: sixteenth, vel: 0.6, look: 0 });
    else if (slot === 2) out.push({ beat: sixteenth, vel: 0.56, look: 0.02 });
    else if (slot === 3) out.push({ beat: sixteenth, vel: 0.55, look: 0.03 });
    else out.push({ beat: sixteenth, vel: 0.4, look: 0.015 }); // soft "e"
  }
  return out;
}

/** Shared with bassPatterns locked-quarters (GT-001). */
const BASS_LOCKED_QUARTERS: CompStroke[] = [
  { beat: 0, vel: 0.62 },
  { beat: 1, vel: 0.56 },
  { beat: 2, vel: 0.6 },
  { beat: 3, vel: 0.55 },
];

export const PIANO_PATTERNS: Record<AccompanimentPattern, PianoPatternDoc> = {
  block: { id: 'block', mode: 'block' },
  arpeggio: { id: 'arpeggio', mode: 'arpeggio' },
  eightBeat: {
    id: 'eightBeat',
    grids: [
      {
        part: 'bass',
        strokes: BASS_LOCKED_QUARTERS,
        nominalRingBeats: 0.5,
        strumSec: 0,
        sparkle: false,
        timingAmountBeats: 0,
        velAmount: 0.03,
      },
      {
        part: 'body',
        strokes: [
          { beat: 0, vel: 0.62, look: 0 },
          { beat: 0.5, vel: 0.52, look: 0.03 },
          { beat: 1, vel: 0.58, look: 0 },
          { beat: 1.5, vel: 0.54, look: 0.04 },
          { beat: 2, vel: 0.6, look: 0 },
          { beat: 2.5, vel: 0.5, look: 0.03 },
          { beat: 3, vel: 0.58, look: 0 },
          { beat: 3.5, vel: 0.55, look: 0.04 },
        ],
        nominalRingBeats: 0.48,
        strumSec: 0.004,
        sparkle: true,
        timingAmountBeats: 0.01,
        velAmount: 0.08,
      },
    ],
  },
  sixteenthBeat: {
    id: 'sixteenthBeat',
    grids: [
      {
        part: 'bass',
        strokes: BASS_LOCKED_QUARTERS,
        nominalRingBeats: 0.5,
        strumSec: 0,
        sparkle: false,
        timingAmountBeats: 0,
        velAmount: 0.03,
      },
      {
        part: 'body',
        strokes: body16Strokes(),
        nominalRingBeats: 0.28,
        strumSec: 0.003,
        sparkle: false,
        timingAmountBeats: 0.008,
        velAmount: 0.08,
      },
    ],
  },
};

export function getPianoPattern(id: AccompanimentPattern): PianoPatternDoc {
  return PIANO_PATTERNS[id] ?? PIANO_PATTERNS.block;
}
