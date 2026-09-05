import type { EvolutionRule, EvolutionRuleRegistry } from './contracts';
import { DIATONIC_SEVENTH_RULE_ID, diatonicSeventhRule } from './rules/diatonicSeventhRule';

const PHASE_1_RULES: Readonly<Record<string, EvolutionRule>> = {
  [DIATONIC_SEVENTH_RULE_ID]: diatonicSeventhRule,
};

export const phase1EvolutionRuleRegistry: EvolutionRuleRegistry = {
  get(ruleId) {
    return PHASE_1_RULES[ruleId];
  },
};

export function phase1EvolutionRules(): readonly EvolutionRule[] {
  return Object.values(PHASE_1_RULES);
}
