/**
 * `compact.v3` — candidate Shared Base Voicing that satisfies the collision
 * contract. NOT listening-approved, so it is never the default.
 *
 * What it changes versus `compact.v2`:
 *   - a close minor second is rejected at any register, not only below E3;
 *   - a minor ninth is rejected unless the chord symbol declares the ♭9;
 *   - a major second below C4 is rejected unless the symbol names a 9th;
 *   - the low interval limit is enforced, so the bass end keeps its air.
 *
 * Everything else — tone importance, spacing, missing-tone pricing, tension
 * register, continuity, path search — is `compact.v2` unchanged. v3 is v2 plus the
 * gate, so a listening comparison isolates the gate rather than confounding it with
 * a second set of changes.
 */

import { baseVoicingTransitionCost } from '../continuity';
import { V3_COST_WEIGHTS, evaluateCompactV3Cost } from './compactV3Costs';
import { searchPathForwardTracked } from './pathSearch';
import { registerPlacementCost } from './registerPlacement';
import { expandedToneFamilies } from './toneImportance';
import type { VoicingPolicySpec } from './types';

export const COMPACT_V3_POLICY: VoicingPolicySpec = {
  id: 'compact.v3',
  label: 'v3 候補（衝突ゲート）',
  listeningApproved: false,
  toneFamilies: (request) => expandedToneFamilies(request),
  rightAnchorMode: 'SOFT',
  staticCost: (notes, preference, context) =>
    registerPlacementCost(notes, preference) +
    evaluateCompactV3Cost(notes, preference, context).totalSoftCost,
  continuityWeight: V3_COST_WEIGHTS.CONTINUITY_WEIGHT,
  transitionCost: baseVoicingTransitionCost,
  searchPath: searchPathForwardTracked,
};
