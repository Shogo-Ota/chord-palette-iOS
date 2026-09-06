import { L2_EVOLUTION_RECIPE_POLICY, type SourceRef } from '@/lib/musicTheory';

import type { EvolutionRecipe, EvolutionRule, EvolutionRuleApplication } from '../contracts';
import { AVAILABLE_TENSION_RULE_ID } from '../rules/availableTensionRule';
import { SMOOTH_SLASH_CHORD_RULE_ID } from '../rules/smoothSlashChordRule';
import type {
  EvolutionCandidate,
  EvolutionChord,
  EvolutionContext,
  EvolutionScope,
  ReharmTechnique,
} from '../types';

export const L2_RECIPE_ID = 'l2-recipe';

const L2_RULE_IDS = [AVAILABLE_TENSION_RULE_ID, SMOOTH_SLASH_CHORD_RULE_ID] as const;

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

function applicationTieBreak(application: EvolutionRuleApplication): string {
  const change = application.change;
  if (change.kind !== 'replace') return `insert:${change.index}`;
  return [
    change.index,
    change.after.symbol.definitionId ?? '',
    change.after.symbol.bassOffset ?? '',
    change.after.chordId,
  ].join(':');
}

function applicationsFor(
  rule: EvolutionRule,
  context: EvolutionContext,
  targetIndex: number,
  dependencies: Parameters<EvolutionRule['generate']>[2],
): readonly EvolutionRuleApplication[] {
  return [...rule.generate(context, targetIndex, dependencies)]
    .filter((application) => application.change.kind === 'replace')
    .sort((left, right) => {
      const byPriority = (left.priority ?? 0) - (right.priority ?? 0);
      return byPriority !== 0
        ? byPriority
        : applicationTieBreak(left).localeCompare(applicationTieBreak(right));
    });
}

function uniqueSources(applications: readonly EvolutionRuleApplication[]): readonly SourceRef[] {
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const source of [
    ...applications.flatMap((application) => application.theorySources),
    L2_EVOLUTION_RECIPE_POLICY.source,
  ]) {
    const key = JSON.stringify(source);
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(source);
  }
  return sources;
}

function candidateId(
  context: EvolutionContext,
  technique: ReharmTechnique,
  lane: number,
  applications: readonly EvolutionRuleApplication[],
): string {
  const replacements = applications
    .map((application) => applicationTieBreak(application))
    .join(',');
  const scope = context.scope.kind === 'chord' ? `chord-${context.scope.index}` : 'progression';
  return `evolution:l2:${technique}:${context.tonic}:${context.mode}:${scope}:lane-${lane}:${replacements}`;
}

function buildCandidate(
  context: EvolutionContext,
  technique: 'add_tension' | 'slash_chord',
  lane: number,
  applications: readonly EvolutionRuleApplication[],
): EvolutionCandidate | null {
  if (applications.length === 0) return null;
  const before = context.progression.map(copyChord);
  const after = context.progression.map(copyChord);
  for (const application of applications) {
    if (application.change.kind !== 'replace') return null;
    after[application.change.index] = copyChord(application.change.after);
  }

  return {
    id: candidateId(context, technique, lane, applications),
    level: 'tension',
    technique,
    scope: copyScope(context.scope),
    before,
    after,
    changes: applications.map((application) => application.change),
    requiredTier: 'PRO',
    theoryLabel: technique === 'add_tension' ? 'AVAILABLE_TENSION' : 'CHORD_TONE_INVERSION',
    rationaleCode:
      technique === 'add_tension'
        ? 'DIATONIC_SEVENTH_TO_AVAILABLE_TENSION'
        : 'CHORD_TONE_BASS_SMOOTHING',
    score: { status: 'UNEVALUATED' },
    generationMethod: 'RULE_BASED',
    evidence: 'DESIGN_TARGET',
    theorySources: uniqueSources(applications),
  };
}

function tensionLanes(
  context: EvolutionContext,
  rule: EvolutionRule,
  dependencies: Parameters<EvolutionRule['generate']>[2],
): readonly EvolutionCandidate[] {
  const byIndex = targetIndices(context).map((index) => ({
    index,
    applications: applicationsFor(rule, context, index, dependencies),
  }));

  return [0, 1, 2].flatMap((lane) => {
    const applications = byIndex.flatMap(({ applications }) =>
      applications[lane] ? [applications[lane]!] : [],
    );
    const candidate = buildCandidate(context, 'add_tension', lane, applications);
    return candidate ? [candidate] : [];
  });
}

function slashLanes(
  context: EvolutionContext,
  rule: EvolutionRule,
  dependencies: Parameters<EvolutionRule['generate']>[2],
): readonly EvolutionCandidate[] {
  const applications = targetIndices(context)
    .flatMap((index) => applicationsFor(rule, context, index, dependencies))
    .sort((left, right) => {
      const byPriority = (left.priority ?? 0) - (right.priority ?? 0);
      return byPriority !== 0
        ? byPriority
        : applicationTieBreak(left).localeCompare(applicationTieBreak(right));
    });

  return applications.slice(0, 3).flatMap((application, lane) => {
    const candidate = buildCandidate(context, 'slash_chord', lane, [application]);
    return candidate ? [candidate] : [];
  });
}

function candidateFingerprint(candidate: EvolutionCandidate): string {
  return candidate.after
    .map((chord) =>
      [
        chord.eventId,
        chord.symbol.definitionId ?? chord.symbol.suffix,
        chord.symbol.bassOffset ?? '',
      ].join(':'),
    )
    .join('|');
}

export const l2Recipe: EvolutionRecipe = {
  id: L2_RECIPE_ID,
  level: 'tension',
  ruleIds: L2_RULE_IDS,
  requiredTier: 'PRO',

  build(context, registry, dependencies): readonly EvolutionCandidate[] {
    const tensionRule = registry.get(AVAILABLE_TENSION_RULE_ID);
    const slashRule = registry.get(SMOOTH_SLASH_CHORD_RULE_ID);
    if (!tensionRule || !slashRule) return [];

    const pools = {
      T: tensionLanes(context, tensionRule, dependencies),
      S: slashLanes(context, slashRule, dependencies),
    } as const;
    const seen = new Set<string>();
    const candidates: EvolutionCandidate[] = [];
    for (const laneId of L2_EVOLUTION_RECIPE_POLICY.candidateLaneOrder) {
      const pool = pools[laneId[0] as 'T' | 'S'];
      const candidate = pool[Number(laneId[1])];
      if (!candidate) continue;
      const fingerprint = candidateFingerprint(candidate);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      candidates.push(candidate);
      if (candidates.length >= L2_EVOLUTION_RECIPE_POLICY.maximumCandidates) {
        break;
      }
    }
    return candidates;
  },
};
