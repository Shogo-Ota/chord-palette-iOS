import type { SourceRef } from '@/lib/musicTheory';

import type { EvolutionRecipe, EvolutionRuleApplication } from '../contracts';
import { DIATONIC_SEVENTH_RULE_ID } from '../rules/diatonicSeventhRule';
import type {
  EvolutionCandidate,
  EvolutionChord,
  EvolutionContext,
  EvolutionScope,
} from '../types';

export const SEVENTH_RECIPE_ID = 'seventh-recipe';

const SEVENTH_RULE_IDS = [DIATONIC_SEVENTH_RULE_ID] as const;
const SEVENTH_REQUIRED_TIER = 'FREE' as const;

function copyChord(chord: EvolutionChord): EvolutionChord {
  return {
    ...chord,
    symbol: {
      ...chord.symbol,
      ...(chord.symbol.rootSpelling ? { rootSpelling: { ...chord.symbol.rootSpelling } } : {}),
    },
    ...(chord.localHarmonicContext
      ? { localHarmonicContext: { ...chord.localHarmonicContext } }
      : {}),
  };
}

function copyScope(scope: EvolutionScope): EvolutionScope {
  return scope.kind === 'chord' ? { kind: 'chord', index: scope.index } : { kind: 'progression' };
}

function targetIndices(context: EvolutionContext): readonly number[] {
  if (context.scope.kind === 'chord') {
    return context.scope.index >= 0 && context.scope.index < context.progression.length
      ? [context.scope.index]
      : [];
  }
  return context.progression.map((_, index) => index);
}

function uniqueSources(applications: readonly EvolutionRuleApplication[]): readonly SourceRef[] {
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const application of applications) {
    for (const source of application.theorySources) {
      const key = JSON.stringify(source);
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(source);
    }
  }
  return sources;
}

function candidateId(
  context: EvolutionContext,
  applications: readonly EvolutionRuleApplication[],
): string {
  const replacements = applications
    .map(({ change }) =>
      change.kind === 'replace'
        ? `${change.index}:${change.after.symbol.definitionId ?? change.after.symbol.suffix}`
        : `insert:${change.index}:${change.inserted.symbol.definitionId ?? change.inserted.symbol.suffix}`,
    )
    .join(',');
  const scope = context.scope.kind === 'chord' ? `chord-${context.scope.index}` : 'progression';
  return `evolution:seventh:${context.tonic}:${context.mode}:${scope}:${replacements}`;
}

export const seventhRecipe: EvolutionRecipe = {
  id: SEVENTH_RECIPE_ID,
  level: 'seventh',
  ruleIds: SEVENTH_RULE_IDS,
  requiredTier: SEVENTH_REQUIRED_TIER,

  build(context, registry, dependencies): readonly EvolutionCandidate[] {
    const before = context.progression.map(copyChord);
    const working = context.progression.map(copyChord);
    const applications: EvolutionRuleApplication[] = [];

    for (const ruleId of SEVENTH_RULE_IDS) {
      const rule = registry.get(ruleId);
      if (!rule) return [];
      for (const targetIndex of targetIndices(context)) {
        const currentContext: EvolutionContext = {
          ...context,
          progression: working,
        };
        const generated = rule.generate(currentContext, targetIndex, dependencies);
        for (const application of generated) {
          if (application.change.kind !== 'replace') continue;
          working[application.change.index] = copyChord(application.change.after);
          applications.push(application);
        }
      }
    }

    if (applications.length === 0) return [];
    const changes = applications.map(({ change }) => change);
    return [
      {
        id: candidateId(context, applications),
        level: 'seventh',
        technique: 'add_seventh',
        scope: copyScope(context.scope),
        before,
        after: working.map(copyChord),
        changes,
        requiredTier: SEVENTH_REQUIRED_TIER,
        theoryLabel: 'DIATONIC_SEVENTH',
        rationaleCode: 'DIATONIC_TRIAD_TO_SEVENTH',
        score: { status: 'UNEVALUATED' },
        generationMethod: 'RULE_BASED',
        evidence: 'DESIGN_TARGET',
        theorySources: uniqueSources(applications),
      },
    ];
  },
};
