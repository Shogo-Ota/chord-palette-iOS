import type { GrooveCandidateStrategy } from './types';
import { cloneTimeline, withRecomputedStarts } from './types';

const MAJOR_GRID_BEATS = 0.5;

export const quantizedControlStrategy: GrooveCandidateStrategy = {
  type: 'QUANTIZED_CONTROL',
  build(repeated) {
    const out = cloneTimeline(repeated);
    out.attacks = out.attacks.map((attack) => ({
      ...attack,
      beatInBar: Math.max(
        0,
        Math.min(
          repeated.beatsPerBar - 1 / 480,
          Math.round(attack.beatInBar / MAJOR_GRID_BEATS) * MAJOR_GRID_BEATS,
        ),
      ),
    }));
    return withRecomputedStarts(out);
  },
};
