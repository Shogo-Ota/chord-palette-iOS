import type { EvolutionRecipe, EvolutionRuleDependencies } from './contracts';
import { chordCatalogEvolutionProvider } from './providers/chordCatalogEvolutionProvider';
import { seventhRecipe } from './recipes/seventhRecipe';
import { phase1EvolutionRuleRegistry } from './ruleRegistry';
import type { EvolutionCandidate, EvolutionContext } from './types';

export const MAX_EVOLUTION_CANDIDATES = 3;

const PHASE_1_RECIPES: readonly EvolutionRecipe[] = [seventhRecipe];

export type EvolutionGeneratorDependencies = Partial<EvolutionRuleDependencies>;

/**
 * Pure deterministic boundary for Phase 1. Recipes are evaluated in declared
 * order and truncated at one shared boundary; they are never cross-multiplied.
 */
export function generateEvolutionCandidates(
  context: EvolutionContext,
  dependencies: EvolutionGeneratorDependencies = {},
): readonly EvolutionCandidate[] {
  const resolvedDependencies: EvolutionRuleDependencies = {
    theory: dependencies.theory ?? chordCatalogEvolutionProvider,
  };

  const candidates = PHASE_1_RECIPES.filter((recipe) => recipe.level === context.level).flatMap(
    (recipe) => recipe.build(context, phase1EvolutionRuleRegistry, resolvedDependencies),
  );

  return candidates.slice(0, MAX_EVOLUTION_CANDIDATES);
}
