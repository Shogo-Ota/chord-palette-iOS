import type { EvolutionRule, EvolutionRuleRegistry } from '../contracts';
import { PASSING_DIMINISHED_RULE_ID, passingDiminishedRule } from './rules/passingDiminishedRule';
import { SECONDARY_DOMINANT_RULE_ID, secondaryDominantRule } from './rules/secondaryDominantRule';
import {
  TRITONE_SUBSTITUTION_RULE_ID,
  tritoneSubstitutionRule,
} from './rules/tritoneSubstitutionRule';

const L3_RULES: Readonly<Record<string, EvolutionRule>> = {
  [SECONDARY_DOMINANT_RULE_ID]: secondaryDominantRule,
  [PASSING_DIMINISHED_RULE_ID]: passingDiminishedRule,
  [TRITONE_SUBSTITUTION_RULE_ID]: tritoneSubstitutionRule,
};

export const l3EvolutionRuleRegistry: EvolutionRuleRegistry = {
  get(ruleId) {
    return L3_RULES[ruleId];
  },
};

export function l3EvolutionRules(): readonly EvolutionRule[] {
  return Object.values(L3_RULES);
}
