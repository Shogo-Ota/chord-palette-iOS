/**
 * Natural-feel comp variant **B — sparse bass** (Good Song Top 10 family F1).
 *
 * Same straight quarter-note chord body as {@link NATURAL_COMP} (A), but the bass
 * plays only the two late off-beats of the bar — the &of2 and &of4 (8th steps 3 & 7).
 * This is the "holding back" bass many of the Top 10 songs use on their calmer 4-bar
 * phrases: fewer notes, more air under the comp.
 *
 * Everything EXCEPT the bass rhythm (drum skeleton, gate, velocity, microtiming,
 * round-robin) is inherited verbatim from A so the whole Natural bank sounds like one
 * player switching phrasing — not three different kits. Used only via the Natural bank
 * (`feel/naturalBank.ts`); never surfaced in the UI.
 */

import { NATURAL_COMP } from './naturalComp';
import type { StylePreset } from './types';

export const NATURAL_COMP_SPARSE: StylePreset = {
  ...NATURAL_COMP,
  id: 'naturalCompSparse',
  displayName: 'Natural Comp (Sparse Bass)',
  // Bass on &of2 / &of4 only (8th steps 3 & 7). Chord grid unchanged (inherited).
  bass: {
    hits: [false, false, false, true, false, false, false, true],
    accent: [0.5, 0.5, 0.5, 0.7, 0.5, 0.5, 0.5, 0.82],
  },
};
