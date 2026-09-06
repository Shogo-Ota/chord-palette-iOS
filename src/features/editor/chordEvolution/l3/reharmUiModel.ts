import {
  generateEvolutionCandidates,
  type EvolutionCandidate,
  type EvolutionScope,
} from '@/lib/harmony/evolution';

import { materializeEvolutionCandidateProgression } from '../candidateMaterializer';
import { sessionToEvolutionContext, type EvolutionSessionProjection } from '../chordEventAdapter';
import {
  buildEvolutionUiModel,
  type EvolutionCandidateViewModel,
  type EvolutionLevelViewModel,
  type EvolutionUiModel,
} from '../uiModel';

export type EvolutionUiLevelWithReharm = 'original' | 'seventh' | 'tension' | 'reharm';

export type ReharmCandidateViewModel = EvolutionCandidateViewModel & {
  readonly rationale: string;
};

export type ReharmLevelViewModel = {
  readonly level: 'reharm';
  readonly label: 'Reharm';
  readonly requiredTier: 'PRO';
  readonly candidates: readonly ReharmCandidateViewModel[];
  readonly emptyMessage?: string;
};

export type EvolutionUiModelWithReharm = Omit<EvolutionUiModel, 'levels'> & {
  readonly levels: readonly (EvolutionLevelViewModel | ReharmLevelViewModel)[];
};

function candidateTitle(candidate: EvolutionCandidate): string {
  if (candidate.technique === 'add_tension') return 'テンション';
  if (candidate.technique === 'slash_chord') return 'なめらかベース';
  if (candidate.technique === 'secondary_dominant') {
    return 'セカンダリードミナント';
  }
  if (candidate.technique === 'passing_diminished') {
    return 'パッシングディミニッシュ';
  }
  return '裏コード';
}

function candidateRationale(candidate: EvolutionCandidate): string {
  if (candidate.technique === 'add_tension') {
    return 'コードの機能を保ったまま、響きに色彩を加えます。';
  }
  if (candidate.technique === 'slash_chord') {
    return 'ベースラインがより滑らかにつながります。';
  }
  if (candidate.technique === 'secondary_dominant') {
    return '解決先へ向かうドミナントを加えて、進行感を強くします。';
  }
  if (candidate.technique === 'passing_diminished') {
    return '半音で動くベースラインで、コード間を滑らかにつなぎます。';
  }
  return 'ドミナントを半音解決する代理コードへ置き換えます。';
}

function reharmCandidates(
  session: EvolutionSessionProjection,
  scope: EvolutionScope,
): readonly ReharmCandidateViewModel[] {
  return generateEvolutionCandidates(sessionToEvolutionContext(session, scope, 'reharm')).flatMap(
    (candidate) => {
      const materialized = materializeEvolutionCandidateProgression(session, candidate);
      if (!materialized.ok) return [];
      return [
        {
          candidate,
          title: candidateTitle(candidate),
          summary: materialized.value.map((event) => event.displayName).join(' · '),
          changedCount: candidate.changes.length,
          rationale: candidateRationale(candidate),
        },
      ];
    },
  );
}

export function buildEvolutionUiModelWithReharm(
  session: EvolutionSessionProjection,
  scope: EvolutionScope,
): EvolutionUiModelWithReharm {
  const base = buildEvolutionUiModel(session, scope);
  if (scope.kind !== 'progression') return base;

  const candidates = reharmCandidates(session, scope);
  return {
    ...base,
    levels: [
      ...base.levels,
      {
        level: 'reharm',
        label: 'Reharm',
        requiredTier: 'PRO',
        candidates,
        ...(candidates.length === 0
          ? {
              emptyMessage:
                session.mode === 'minor'
                  ? 'Reharmは現在メジャーキーで利用できます'
                  : 'このレベルの候補はありません',
            }
          : {}),
      },
    ],
  };
}
