import { isLocked, type Entitlements } from '@/lib/entitlements';
import type { EvolutionCandidate } from '@/lib/harmony/evolution';

export type EvolutionCandidateAccess = {
  readonly canPreview: true;
  readonly canApply: boolean;
  readonly requiresPro: boolean;
};

/** UI access policy only; billing providers never enter the Evolution Domain. */
export function evolutionCandidateAccess(
  candidate: Pick<EvolutionCandidate, 'requiredTier'>,
  entitlements: Entitlements,
): EvolutionCandidateAccess {
  const requiresPro = candidate.requiredTier === 'PRO';
  return {
    canPreview: true,
    canApply: !isLocked(requiresPro, entitlements),
    requiresPro,
  };
}
