import type { EvolutionRecipe, EvolutionRuleDependencies } from './contracts';
import { chordCatalogEvolutionProvider } from './providers/chordCatalogEvolutionProvider';
import { chordCatalogTensionProvider } from './providers/chordCatalogTensionProvider';
import { chordToneSlashProvider } from './providers/chordToneSlashProvider';
import { l2Recipe } from './recipes/l2Recipe';
import { seventhRecipe } from './recipes/seventhRecipe';
import { evolutionRuleRegistry } from './ruleRegistry';
import type { EvolutionCandidate, EvolutionContext } from './types';

export const MAX_EVOLUTION_CANDIDATES = 3;

const EVOLUTION_RECIPES: readonly EvolutionRecipe[] = [seventhRecipe, l2Recipe];

export type EvolutionGeneratorDependencies = Partial<EvolutionRuleDependencies>;

/**
 * Pure deterministic boundary. Recipes are evaluated in declared
 * order and truncated at one shared boundary; they are never cross-multiplied.
 */
export function generateEvolutionCandidates(
  context: EvolutionContext,
  dependencies: EvolutionGeneratorDependencies = {},
): readonly EvolutionCandidate[] {
  const resolvedDependencies: EvolutionRuleDependencies = {
    theory: dependencies.theory ?? chordCatalogEvolutionProvider,
    tension: dependencies.tension ?? chordCatalogTensionProvider,
    slash: dependencies.slash ?? chordToneSlashProvider,
  };

  const candidates = EVOLUTION_RECIPES.filter((recipe) => recipe.level === context.level).flatMap(
    (recipe) => recipe.build(context, evolutionRuleRegistry, resolvedDependencies),
  );

  return candidates.slice(0, MAX_EVOLUTION_CANDIDATES);
}
