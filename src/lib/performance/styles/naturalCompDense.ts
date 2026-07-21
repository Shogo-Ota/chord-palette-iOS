/**
 * Natural-feel comp variant **C — dense bass** (Good Song Top 10 family F0).
 *
 * Same straight quarter-note chord body as {@link NATURAL_COMP} (A), but a busier,
 * walking-ish bass: &of1, the beat-2 head, &of3, the beat-4 head and &of4
 * (8th steps 1, 2, 5, 6, 7 → bass8 = [F,T,T,F,F,T,T,T]). This is the driving-but-still
 * natural bass the up-tempo Top 10 phrases lean on — the one bank member that puts a
 * bass note on beat 2 (step 2), which A and B never do.
 *
 * Everything EXCEPT the bass rhythm (drum skeleton, gate, velocity, microtiming,
 * round-robin) is inherited verbatim from A. Used only via the Natural bank
 * (`feel/naturalBank.ts`); never surfaced in the UI.
 */

import { NATURAL_COMP } from './naturalComp';
import type { StylePreset } from './types';

export const NATURAL_COMP_DENSE: StylePreset = {
  ...NATURAL_COMP,
  id: 'naturalCompDense',
  displayName: 'Natural Comp (Dense Bass)',
  // Busy bass: &1, beat2, &3, beat4, &4 (8th steps 1,2,5,6,7). Chord grid unchanged.
  bass: {
    hits: [false, true, true, false, false, true, true, true],
    accent: [0.5, 0.68, 0.78, 0.5, 0.5, 0.68, 0.72, 0.82],
  },
};
