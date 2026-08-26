/**
 * `compact.v1` — the Shared Base Voicing a human approved by ear at 87/100
 * (build 1.0.2 (11), device listening 2026-08-20).
 *
 * FROZEN. `releaseAccompanimentBaselineV87` pins its audible output byte for
 * byte, so nothing here may be retuned, reordered or "cleaned up": the cost
 * accumulation order is itself part of the approved result. A better musical
 * opinion ships as a new policy id, gets its own listening pass, and only then
 * becomes the default.
 *
 * Its known limits, documented rather than patched: low-register minor seconds
 * are merely expensive instead of rejected, and an explicit inversion filters
 * candidates on the right-hand anchor, which can force a cluster.
 */

import { baseVoicingTransitionCost } from '../continuity';
import type { BaseVoicingNote, BaseVoicingPreference } from '../types';
import { searchPathPerStart } from './pathSearch';
import { registerPlacementCost } from './registerPlacement';
import { primaryToneFamily } from './toneImportance';
import type { VoicingPolicySpec } from './types';

/**
 * Register placement plus two flat low-register penalties: any narrow pair below
 * E3 and any seventh or extension below F3. Kept as one accumulation so the
 * arithmetic matches the approved baseline exactly.
 */
function legacyStaticVoicingCost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
): number {
  const right = notes.filter((note) => note.hand === 'RH').sort((a, b) => a.pitch - b.pitch);
  let cost = registerPlacementCost(notes, preference);

  right.forEach((note, index) => {
    if (
      index < right.length - 1 &&
      note.pitch < 55 + preference.octaveShift * 12 &&
      right[index + 1]!.pitch - note.pitch <= 2
    ) {
      cost += 14;
    }
    if (
      (note.degree === 'ninth' ||
        note.degree === 'eleventh' ||
        note.degree === 'thirteenth' ||
        note.degree === 'seventh') &&
      note.pitch < 53 + preference.octaveShift * 12
    ) {
      cost += (53 + preference.octaveShift * 12 - note.pitch) * 1.5;
    }
  });
  return cost;
}

export const COMPACT_V1_POLICY: VoicingPolicySpec = {
  id: 'compact.v1',
  label: 'v1 承認済み（87点）',
  listeningApproved: true,
  toneFamilies: ({ specs, bass }) => [primaryToneFamily(specs, bass)],
  rightAnchorMode: 'HARD',
  staticCost: (notes, preference) => legacyStaticVoicingCost(notes, preference),
  continuityWeight: 1,
  transitionCost: baseVoicingTransitionCost,
  searchPath: searchPathPerStart,
};
