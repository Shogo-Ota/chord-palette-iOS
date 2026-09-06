import type { EvolutionRule, EvolutionRuleRegistry } from './contracts';
import { AVAILABLE_TENSION_RULE_ID, availableTensionRule } from './rules/availableTensionRule';
import { DIATONIC_SEVENTH_RULE_ID, diatonicSeventhRule } from './rules/diatonicSeventhRule';
import { SMOOTH_SLASH_CHORD_RULE_ID, smoothSlashChordRule } from './rules/smoothSlashChordRule';

const PHASE_1_RULES: Readonly<Record<string, EvolutionRule>> = {
  [DIATONIC_SEVENTH_RULE_ID]: diatonicSeventhRule,
};

const EVOLUTION_RULES: Readonly<Record<string, EvolutionRule>> = {
  ...PHASE_1_RULES,
  [AVAILABLE_TENSION_RULE_ID]: availableTensionRule,
  [SMOOTH_SLASH_CHORD_RULE_ID]: smoothSlashChordRule,
};

export const phase1EvolutionRuleRegistry: EvolutionRuleRegistry = {
  get(ruleId) {
    return PHASE_1_RULES[ruleId];
  },
};

export const evolutionRuleRegistry: EvolutionRuleRegistry = {
  get(ruleId) {
    return EVOLUTION_RULES[ruleId];
  },
};

export function phase1EvolutionRules(): readonly EvolutionRule[] {
  return Object.values(PHASE_1_RULES);
}

export function evolutionRules(): readonly EvolutionRule[] {
  return Object.values(EVOLUTION_RULES);
}
