/**
 * `compact.v2` — candidate Shared Base Voicing. NOT listening-approved yet, so
 * it is never the default; `voicingPolicyV2Candidate` pins its output only so
 * further edits stay visible.
 *
 * What it changes versus `compact.v1`:
 *   - spacing and dissonance are graded by register and by role, so a legal
 *     tension is spread rather than deleted to clear a cluster;
 *   - only an extreme low-register minor second is rejected outright;
 *   - a missing chord tone is priced interval by interval;
 *   - thinner right hands are offered, so a packed close voicing is one option
 *     rather than the only one;
 *   - the inversion anchor is priced instead of filtered;
 *   - voice leading weighs less than static quality, and path search is a single
 *     forward pass.
 */

import { baseVoicingTransitionCost } from '../continuity';
import { V2_COST_WEIGHTS, evaluateCompactV2Cost } from './compactV2Costs';
import { searchPathForwardTracked } from './pathSearch';
import { registerPlacementCost } from './registerPlacement';
import { expandedToneFamilies } from './toneImportance';
import type { VoicingPolicySpec } from './types';

export const COMPACT_V2_POLICY: VoicingPolicySpec = {
  id: 'compact.v2',
  label: 'v2 候補（試聴前）',
  listeningApproved: false,
  toneFamilies: (request) => expandedToneFamilies(request),
  rightAnchorMode: 'SOFT',
  staticCost: (notes, preference, context) => {
    const evaluation = evaluateCompactV2Cost(notes, preference, context);
    if (evaluation.hardReject) return Number.POSITIVE_INFINITY;
    return registerPlacementCost(notes, preference) + evaluation.totalSoftCost;
  },
  continuityWeight: V2_COST_WEIGHTS.CONTINUITY_WEIGHT,
  transitionCost: baseVoicingTransitionCost,
  searchPath: searchPathForwardTracked,
};
