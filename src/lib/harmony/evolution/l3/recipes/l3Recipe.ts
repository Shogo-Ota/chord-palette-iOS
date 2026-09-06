import type { EvolutionRecipe, EvolutionRuleApplication } from '../../contracts';
import type { EvolutionCandidate } from '../../types';
import type { L3Technique } from '../contracts';
import { PASSING_DIMINISHED_RULE_ID } from '../rules/passingDiminishedRule';
import { SECONDARY_DOMINANT_RULE_ID } from '../rules/secondaryDominantRule';
import { TRITONE_SUBSTITUTION_RULE_ID } from '../rules/tritoneSubstitutionRule';
import { buildL3Candidate } from './l3CandidateFactory';

export const L3_RECIPE_ID = 'l3-reharm-recipe';

export const L3_RULE_IDS = [
  SECONDARY_DOMINANT_RULE_ID,
  PASSING_DIMINISHED_RULE_ID,
  TRITONE_SUBSTITUTION_RULE_ID,
] as const;

function applicationKey(application: EvolutionRuleApplication): string {
  const change = application.change;
  return change.kind === 'replace'
    ? `replace:${change.index}:${change.after.chordId}`
    : `insert:${change.index}:${change.inserted.chordId}`;
}

export const l3Recipe: EvolutionRecipe = {
  id: L3_RECIPE_ID,
  level: 'reharm',
  ruleIds: L3_RULE_IDS,
  requiredTier: 'PRO',

  build(context, registry, dependencies): readonly EvolutionCandidate[] {
    if (
      context.level !== 'reharm' ||
      context.mode !== 'major' ||
      context.scope.kind !== 'progression'
    ) {
      return [];
    }

    return L3_RULE_IDS.flatMap((ruleId) => {
      const rule = registry.get(ruleId);
      if (!rule) return [];
      const applications = context.progression
        .flatMap((_, targetIndex) => rule.generate(context, targetIndex, dependencies))
        .sort((left, right) => {
          const byPriority = (left.priority ?? 0) - (right.priority ?? 0);
          return byPriority !== 0
            ? byPriority
            : applicationKey(left).localeCompare(applicationKey(right));
        });
      return applications.flatMap((application, lane) => {
        const candidate = buildL3Candidate(
          context,
          rule.technique as L3Technique,
          lane,
          application,
        );
        return candidate ? [candidate] : [];
      });
    });
  },
};
