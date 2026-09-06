import type { EvolutionRecipe, EvolutionRuleDependencies } from './contracts';
import { chordCatalogEvolutionProvider } from './providers/chordCatalogEvolutionProvider';
import { chordCatalogTensionProvider } from './providers/chordCatalogTensionProvider';
import { chordToneSlashProvider } from './providers/chordToneSlashProvider';
import { generateL3Candidates } from './l3/generateL3Candidates';
import { passingDiminishedProvider } from './l3/providers/passingDiminishedProvider';
import { secondaryDominantProvider } from './l3/providers/secondaryDominantProvider';
import { tritoneSubstitutionProvider } from './l3/providers/tritoneSubstitutionProvider';
import { l2Recipe } from './recipes/l2Recipe';
import { seventhRecipe } from './recipes/seventhRecipe';
import { evolutionRuleRegistry } from './ruleRegistry';
import type { EvolutionCandidate, EvolutionContext } from './types';

export const MAX_EVOLUTION_CANDIDATES = 3;

const EVOLUTION_RECIPES: readonly EvolutionRecipe[] = [seventhRecipe, l2Recipe];

export type EvolutionGeneratorDependencies = Partial<EvolutionRuleDependencies>;

function generateExistingLevelCandidates(
  context: EvolutionContext,
  dependencies: EvolutionRuleDependencies,
): readonly EvolutionCandidate[] {
  return EVOLUTION_RECIPES.filter((recipe) => recipe.level === context.level).flatMap((recipe) =>
    recipe.build(context, evolutionRuleRegistry, dependencies),
  );
}

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
    secondaryDominant: dependencies.secondaryDominant ?? secondaryDominantProvider,
    passingDiminished: dependencies.passingDiminished ?? passingDiminishedProvider,
    tritoneSubstitution: dependencies.tritoneSubstitution ?? tritoneSubstitutionProvider,
  };

  if (context.level === 'reharm') {
    const frozenL2Candidates = generateExistingLevelCandidates(
      { ...context, level: 'tension' },
      resolvedDependencies,
    );
    return generateL3Candidates(context, resolvedDependencies, frozenL2Candidates);
  }

  return generateExistingLevelCandidates(context, resolvedDependencies).slice(
    0,
    MAX_EVOLUTION_CANDIDATES,
  );
}
