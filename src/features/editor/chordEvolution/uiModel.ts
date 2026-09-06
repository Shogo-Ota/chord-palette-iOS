import {
  generateEvolutionCandidates,
  type EvolutionCandidate,
  type EvolutionScope,
} from '@/lib/harmony/evolution';

import {
  materializeCandidateProgression,
  sessionToEvolutionContext,
  type EvolutionSessionProjection,
} from './chordEventAdapter';

export type EvolutionUiLevel = 'original' | 'seventh' | 'tension';

export type EvolutionCandidateViewModel = {
  readonly candidate: EvolutionCandidate;
  readonly title: string;
  readonly summary: string;
  readonly changedCount: number;
};

export type EvolutionLevelViewModel = {
  readonly level: EvolutionUiLevel;
  readonly label: 'Original' | '7th' | 'Rich';
  readonly requiredTier: 'FREE' | 'PRO';
  readonly candidates: readonly EvolutionCandidateViewModel[];
  readonly emptyMessage?: string;
};

export type EvolutionUiModel = {
  readonly scope: EvolutionScope;
  readonly scopeLabel: 'このコード' | '進行全体';
  readonly originalSummary: string;
  readonly levels: readonly EvolutionLevelViewModel[];
};

function copyScope(scope: EvolutionScope): EvolutionScope {
  return scope.kind === 'chord' ? { kind: 'chord', index: scope.index } : { kind: 'progression' };
}

function originalSummary(session: EvolutionSessionProjection, scope: EvolutionScope): string {
  if (scope.kind === 'chord') {
    return session.progression[scope.index]?.displayName ?? '';
  }
  return session.progression.map((event) => event.displayName).join(' · ');
}

function candidateTitle(candidate: EvolutionCandidate): string {
  if (candidate.technique === 'add_seventh') return '7thコード';
  if (candidate.technique === 'add_tension') return 'テンション';
  return 'なめらかベース';
}

function candidateViewModels(
  session: EvolutionSessionProjection,
  candidates: readonly EvolutionCandidate[],
): readonly EvolutionCandidateViewModel[] {
  return candidates.flatMap((candidate) => {
    const materialized = materializeCandidateProgression(session, candidate);
    if (!materialized.ok) return [];
    const changedIndices = candidate.changes.flatMap((change) =>
      change.kind === 'replace' ? [change.index] : [],
    );
    const summary =
      candidate.scope.kind === 'chord'
        ? `${session.progression[candidate.scope.index]?.displayName ?? ''} → ${
            materialized.value[candidate.scope.index]?.displayName ?? ''
          }`
        : materialized.value.map((event) => event.displayName).join(' · ');
    return [
      {
        candidate,
        title: candidateTitle(candidate),
        summary,
        changedCount: changedIndices.length,
      },
    ];
  });
}

export function buildEvolutionUiModel(
  session: EvolutionSessionProjection,
  scope: EvolutionScope,
): EvolutionUiModel {
  const stableScope = copyScope(scope);
  const l1Candidates = candidateViewModels(
    session,
    generateEvolutionCandidates(sessionToEvolutionContext(session, stableScope, 'seventh')),
  );
  const l2Candidates = candidateViewModels(
    session,
    generateEvolutionCandidates(sessionToEvolutionContext(session, stableScope, 'tension')),
  );

  return {
    scope: stableScope,
    scopeLabel: stableScope.kind === 'chord' ? 'このコード' : '進行全体',
    originalSummary: originalSummary(session, stableScope),
    levels: [
      {
        level: 'original',
        label: 'Original',
        requiredTier: 'FREE',
        candidates: [],
      },
      {
        level: 'seventh',
        label: '7th',
        requiredTier: 'FREE',
        candidates: l1Candidates,
        ...(l1Candidates.length === 0 ? { emptyMessage: 'このレベルの候補はありません' } : {}),
      },
      {
        level: 'tension',
        label: 'Rich',
        requiredTier: 'PRO',
        candidates: l2Candidates,
        ...(l2Candidates.length === 0
          ? {
              emptyMessage:
                l1Candidates.length > 0
                  ? '先に7thを適用するとRich候補を探せます'
                  : 'このレベルの候補はありません',
            }
          : {}),
      },
    ],
  };
}
