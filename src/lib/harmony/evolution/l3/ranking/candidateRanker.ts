import type { EvolutionCandidate, EvolutionContext } from '../../types';
import { evolutionCandidateFingerprint } from './candidateFingerprint';
import { scoreEvolutionCandidate } from './candidateScorer';
import { selectDiverseCandidates } from './candidateDiversity';
import { isValidReharmCandidate } from './hardValidator';

export function rankEvolutionCandidates(
  context: EvolutionContext,
  candidates: readonly EvolutionCandidate[],
): readonly EvolutionCandidate[] {
  const seen = new Set<string>();
  const validUnique = candidates.filter((candidate) => {
    if (!isValidReharmCandidate(context, candidate)) return false;
    const fingerprint = evolutionCandidateFingerprint(candidate);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
  return selectDiverseCandidates(validUnique.map(scoreEvolutionCandidate));
}
