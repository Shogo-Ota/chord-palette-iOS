import type { TimelineAttack } from '../types';
import type { GrooveCandidateStrategy } from './types';
import { cloneTimeline } from './types';

function groupVelocity(attack: TimelineAttack): number {
  if (attack.notes.length === 0) return 0;
  return attack.notes.reduce((sum, note) => sum + note.velocity, 0) / attack.notes.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const simplifiedDensityStrategy: GrooveCandidateStrategy = {
  type: 'SIMPLIFIED_DENSITY',
  build(repeated) {
    const out = cloneTimeline(repeated);
    const keepIds = new Set<string>();

    for (let bar = 0; bar < repeated.totalBars; bar += 1) {
      const attacks = out.attacks.filter((attack) => attack.barIndex === bar);
      if (attacks.length === 0) continue;
      const velocityMedian = median(attacks.map(groupVelocity));
      keepIds.add(attacks[0].sourceId);
      for (const attack of attacks) {
        const onWholeBeat = Math.abs(attack.beatInBar - Math.round(attack.beatInBar)) < 1e-6;
        const accented = groupVelocity(attack) >= velocityMedian;
        if (onWholeBeat || accented) keepIds.add(attack.sourceId);
      }
    }

    out.attacks = out.attacks.filter((attack) => keepIds.has(attack.sourceId));
    // Deliberately do not extend surviving durations: density and articulation remain separate.
    return out;
  },
};
