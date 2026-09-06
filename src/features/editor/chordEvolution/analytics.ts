import type { EvolutionCandidate, EvolutionLevel, EvolutionScope } from '@/lib/harmony/evolution';
import type { KeyMode } from '@/types';
import { track, type AnalyticsEvent, type AnalyticsProps } from '@/services/analytics';

export type EvolutionAnalyticsEvent = Extract<
  AnalyticsEvent,
  | 'evolution_opened'
  | 'evolution_level_previewed'
  | 'evolution_candidate_previewed'
  | 'evolution_applied'
  | 'evolution_undo'
  | 'evolution_paywall_shown'
>;

export type EvolutionTrack = (event: EvolutionAnalyticsEvent, props: AnalyticsProps) => void;

export const trackEvolution: EvolutionTrack = (event, props) => track(event, props);

export function evolutionScopeName(scope: EvolutionScope): 'chord' | 'progression' {
  return scope.kind;
}

export function evolutionOpenedProps(scope: EvolutionScope, mode: KeyMode): AnalyticsProps {
  return { scope: evolutionScopeName(scope), mode };
}

export function evolutionLevelProps(
  scope: EvolutionScope,
  level: Extract<EvolutionLevel, 'original' | 'seventh' | 'tension'>,
  mode: KeyMode,
): AnalyticsProps {
  return {
    scope: evolutionScopeName(scope),
    level,
    mode,
    requiredTier: level === 'tension' ? 'PRO' : 'FREE',
  };
}

export function evolutionCandidateProps(
  candidate: Pick<EvolutionCandidate, 'scope' | 'level' | 'technique' | 'requiredTier'>,
  mode: KeyMode,
): AnalyticsProps {
  return {
    scope: evolutionScopeName(candidate.scope),
    level: candidate.level,
    technique: candidate.technique,
    mode,
    requiredTier: candidate.requiredTier,
  };
}
