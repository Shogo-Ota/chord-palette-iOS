import type { GrooveCandidateStrategy } from './types';
import { cloneTimeline } from './types';

/**
 * Preserve the exact onset count and velocity multiset, but rotate velocities across
 * time. Mean, variance and range remain unchanged; only timing–velocity relation moves.
 */
export const brokenControlStrategy: GrooveCandidateStrategy = {
  type: 'BROKEN_CONTROL',
  build(repeated) {
    const out = cloneTimeline(repeated);
    const noteRefs = out.attacks.flatMap((attack) =>
      attack.notes.map((note) => ({ attack, note })),
    );
    const velocities = noteRefs.map(({ note }) => note.velocity);
    if (velocities.length < 2) return out;

    // One-note rotation is intentionally mild: distribution is identical and the
    // listener hears a changed accent relation, not an obviously broken performance.
    const shift = 1;
    noteRefs.forEach(({ note }, index) => {
      note.velocity = velocities[(index + shift) % velocities.length];
    });
    return out;
  },
};
