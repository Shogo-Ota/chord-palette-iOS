/**
 * First blind listening (2026-08-15): C|Am|F|G, X > Y > Z.
 * Three pairs only — not enough to fit production weights.
 */

import type { PreferencePairRow } from './preferencePairs';

export const FIRST_LISTENING_ORDER = 'X > Y > Z';

export const FIRST_LISTENING_PAIRS: readonly PreferencePairRow[] = [
  {
    progressionId: 'A',
    preferredId: 'A-connectedStable',
    rejectedId: 'A-rootReset',
    preferredLabel: 'X',
    rejectedLabel: 'Y',
  },
  {
    progressionId: 'A',
    preferredId: 'A-connectedStable',
    rejectedId: 'A-brokenOutlier',
    preferredLabel: 'X',
    rejectedLabel: 'Z',
  },
  {
    progressionId: 'A',
    preferredId: 'A-rootReset',
    rejectedId: 'A-brokenOutlier',
    preferredLabel: 'Y',
    rejectedLabel: 'Z',
  },
];
