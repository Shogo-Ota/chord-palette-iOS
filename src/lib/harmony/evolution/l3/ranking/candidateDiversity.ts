import { L3_RANKING_POLICY } from '@/lib/musicTheory';

import type { EvolutionCandidate, ReharmTechnique } from '../../types';
import type { L3HarmonicEffect } from '../contracts';

export function harmonicEffectForTechnique(technique: ReharmTechnique): L3HarmonicEffect {
  if (technique === 'add_tension' || technique === 'add_seventh') {
    return 'COLOR_EXTENSION';
  }
  if (technique === 'slash_chord') return 'BASS_SMOOTHING';
  if (technique === 'secondary_dominant') return 'DOMINANT_RESOLUTION';
  if (technique === 'passing_diminished') return 'CHROMATIC_CONNECTOR';
  return 'DOMINANT_SUBSTITUTION';
}

function scoredTotal(candidate: EvolutionCandidate): number {
  return candidate.score.status === 'SCORED' ? candidate.score.total : Number.NEGATIVE_INFINITY;
}

function diversityAdjustedScore(
  candidate: EvolutionCandidate,
  selected: readonly EvolutionCandidate[],
): number {
  const sameTechnique = selected.filter((item) => item.technique === candidate.technique).length;
  const effect = harmonicEffectForTechnique(candidate.technique);
  const sameEffect = selected.filter(
    (item) => harmonicEffectForTechnique(item.technique) === effect,
  ).length;
  return (
    scoredTotal(candidate) -
    sameTechnique * L3_RANKING_POLICY.diversityPenalties.sameTechnique -
    sameEffect * L3_RANKING_POLICY.diversityPenalties.sameHarmonicEffect
  );
}

export function selectDiverseCandidates(
  candidates: readonly EvolutionCandidate[],
): readonly EvolutionCandidate[] {
  const remaining = [...candidates];
  const selected: EvolutionCandidate[] = [];
  while (remaining.length > 0 && selected.length < L3_RANKING_POLICY.maximumCandidates) {
    remaining.sort((left, right) => {
      const adjusted =
        diversityAdjustedScore(right, selected) - diversityAdjustedScore(left, selected);
      if (adjusted !== 0) return adjusted;
      const base = scoredTotal(right) - scoredTotal(left);
      return base !== 0 ? base : left.id.localeCompare(right.id);
    });
    selected.push(remaining.shift()!);
  }
  return selected;
}
