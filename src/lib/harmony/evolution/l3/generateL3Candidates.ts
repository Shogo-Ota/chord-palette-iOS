import type { EvolutionRuleDependencies } from '../contracts';
import type { EvolutionCandidate, EvolutionContext } from '../types';
import { rankEvolutionCandidates } from './ranking/candidateRanker';
import { l3Recipe } from './recipes/l3Recipe';
import { l3EvolutionRuleRegistry } from './ruleRegistry';

export function generateL3Candidates(
  context: EvolutionContext,
  dependencies: EvolutionRuleDependencies,
  frozenL2Candidates: readonly EvolutionCandidate[],
): readonly EvolutionCandidate[] {
  if (
    context.level !== 'reharm' ||
    context.mode !== 'major' ||
    context.scope.kind !== 'progression'
  ) {
    return [];
  }
  const l3Candidates = l3Recipe.build(context, l3EvolutionRuleRegistry, dependencies);
  return rankEvolutionCandidates(context, [...frozenL2Candidates, ...l3Candidates]);
}
