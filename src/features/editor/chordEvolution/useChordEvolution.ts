import { useCallback, useMemo, useRef, useState } from 'react';

import { featureFlags } from '@/config/featureFlags';
import { sessionToPlaybackRequest } from '@/features/editor/playback';
import { getSession, undo as undoSession, type EditorSession } from '@/features/editor/session';
import type { Entitlements } from '@/lib/entitlements';
import type { EvolutionCandidate, EvolutionScope } from '@/lib/harmony/evolution';
import type { Tier } from '@/lib/performance/tier';
import { audioService } from '@/services/audio';

import { evolutionCandidateAccess } from './accessPolicy';
import {
  evolutionCandidateProps,
  evolutionLevelProps,
  evolutionOpenedProps,
  trackEvolution,
  type EvolutionTrack,
} from './analytics';
import { applyEvolutionCandidate } from './apply';
import { buildEvolutionPreviewRequest } from './preview';
import { buildEvolutionUiModel, type EvolutionUiLevel } from './uiModel';

export type EvolutionUiApplyOutcome =
  ReturnType<typeof applyEvolutionCandidate> | { readonly status: 'PAYWALL' };

type UndoMarker = {
  readonly progression: readonly unknown[];
  readonly props: ReturnType<typeof evolutionCandidateProps>;
};

export type ChordEvolutionControllerDependencies = {
  readonly play: typeof audioService.play;
  readonly stop: typeof audioService.stop;
  readonly apply: typeof applyEvolutionCandidate;
  readonly getSession: typeof getSession;
  readonly undo: typeof undoSession;
  readonly track: EvolutionTrack;
};

const DEFAULT_DEPENDENCIES: ChordEvolutionControllerDependencies = {
  play: (request) => audioService.play(request),
  stop: () => audioService.stop(),
  apply: applyEvolutionCandidate,
  getSession,
  undo: undoSession,
  track: trackEvolution,
};

export type UseChordEvolutionOptions = {
  readonly session: EditorSession;
  readonly entitlements: Entitlements;
  readonly tier: Tier;
  readonly enabled?: boolean;
  readonly onOpenPaywall: () => void;
  readonly onError?: (message: string) => void;
  readonly dependencies?: ChordEvolutionControllerDependencies;
};

export function useChordEvolution(options: UseChordEvolutionOptions) {
  const {
    session,
    entitlements,
    tier,
    enabled = featureFlags.chordEvolution,
    onOpenPaywall,
    onError,
    dependencies = DEFAULT_DEPENDENCIES,
  } = options;
  const [visible, setVisible] = useState(false);
  const [scope, setScope] = useState<EvolutionScope>({
    kind: 'progression',
  });
  const [activeLevel, setActiveLevel] = useState<EvolutionUiLevel>('original');
  const activeLevelRef = useRef<EvolutionUiLevel>('original');
  const openGuardRef = useRef(false);
  const previewingRef = useRef(false);
  const applyingRef = useRef(false);
  const paywallGuardRef = useRef(false);
  const undoMarkerRef = useRef<UndoMarker | null>(null);

  const model = useMemo(
    () => (enabled && visible ? buildEvolutionUiModel(session, scope) : null),
    [enabled, scope, session, visible],
  );
  const activeSection = useMemo(
    () => model?.levels.find((section) => section.level === activeLevel) ?? null,
    [activeLevel, model],
  );
  const sheetCandidates = useMemo(
    () =>
      activeSection?.candidates.map((viewModel) => {
        const access = evolutionCandidateAccess(viewModel.candidate, entitlements);
        return {
          id: viewModel.candidate.id,
          title: viewModel.title,
          summary: viewModel.summary,
          changedCount: viewModel.changedCount,
          applyLocked: !access.canApply,
          applyLabel: access.canApply ? ('適用' as const) : ('Proで適用' as const),
        };
      }) ?? [],
    [activeSection, entitlements],
  );

  const open = useCallback(
    (nextScope: EvolutionScope) => {
      const validScope =
        nextScope.kind === 'progression'
          ? session.progression.length > 0
          : nextScope.index >= 0 && nextScope.index < session.progression.length;
      if (!enabled || !validScope || openGuardRef.current) return;
      openGuardRef.current = true;
      paywallGuardRef.current = false;
      activeLevelRef.current = 'original';
      setActiveLevel('original');
      setScope(
        nextScope.kind === 'chord'
          ? { kind: 'chord', index: nextScope.index }
          : { kind: 'progression' },
      );
      setVisible(true);
      dependencies.track('evolution_opened', evolutionOpenedProps(nextScope, session.mode));
    },
    [dependencies, enabled, session.mode, session.progression.length],
  );

  const close = useCallback(() => {
    void dependencies.stop().catch(() => undefined);
    setVisible(false);
    openGuardRef.current = false;
    paywallGuardRef.current = false;
  }, [dependencies]);

  const selectLevel = useCallback(
    (level: EvolutionUiLevel) => {
      if (!enabled || !visible || activeLevelRef.current === level) return;
      activeLevelRef.current = level;
      setActiveLevel(level);
      dependencies.track(
        'evolution_level_previewed',
        evolutionLevelProps(scope, level, session.mode),
      );
    },
    [dependencies, enabled, scope, session.mode, visible],
  );

  const previewOriginal = useCallback(async (): Promise<boolean> => {
    if (!enabled || !visible || previewingRef.current) return false;
    previewingRef.current = true;
    try {
      await dependencies.play(sessionToPlaybackRequest(session, false, tier));
      return true;
    } catch {
      onError?.('Originalの試聴に失敗しました。');
      return false;
    } finally {
      previewingRef.current = false;
    }
  }, [dependencies, enabled, onError, session, tier, visible]);

  const previewCandidate = useCallback(
    async (candidate: EvolutionCandidate): Promise<boolean> => {
      if (!enabled || !visible || previewingRef.current) return false;
      previewingRef.current = true;
      try {
        const request = buildEvolutionPreviewRequest(session, candidate, tier);
        if (!request.ok) {
          onError?.('候補を試聴できませんでした。');
          return false;
        }
        await dependencies.play(request.value);
        dependencies.track(
          'evolution_candidate_previewed',
          evolutionCandidateProps(candidate, session.mode),
        );
        return true;
      } catch {
        onError?.('候補の試聴に失敗しました。');
        return false;
      } finally {
        previewingRef.current = false;
      }
    },
    [dependencies, enabled, onError, session, tier, visible],
  );

  const applyCandidate = useCallback(
    (candidate: EvolutionCandidate): EvolutionUiApplyOutcome => {
      if (!enabled || !visible || applyingRef.current) {
        return { status: 'REJECTED', reason: 'SESSION_CHANGED' };
      }
      const access = evolutionCandidateAccess(candidate, entitlements);
      if (!access.canApply) {
        if (paywallGuardRef.current) return { status: 'PAYWALL' };
        paywallGuardRef.current = true;
        void dependencies.stop().catch(() => undefined);
        setVisible(false);
        openGuardRef.current = false;
        dependencies.track(
          'evolution_paywall_shown',
          evolutionCandidateProps(candidate, session.mode),
        );
        onOpenPaywall();
        return { status: 'PAYWALL' };
      }

      applyingRef.current = true;
      try {
        void dependencies.stop().catch(() => undefined);
        const result = dependencies.apply(candidate);
        if (result.status === 'APPLIED') {
          const props = evolutionCandidateProps(candidate, session.mode);
          undoMarkerRef.current = {
            progression: dependencies.getSession().progression,
            props,
          };
          dependencies.track('evolution_applied', props);
          setVisible(false);
          openGuardRef.current = false;
        } else {
          onError?.('候補を適用できませんでした。');
        }
        return result;
      } finally {
        applyingRef.current = false;
      }
    },
    [dependencies, enabled, entitlements, onError, onOpenPaywall, session.mode, visible],
  );

  const undo = useCallback(() => {
    const current = dependencies.getSession();
    const marker = undoMarkerRef.current;
    const isEvolutionUndo =
      marker != null && current.history.length > 0 && current.progression === marker.progression;
    dependencies.undo();
    if (isEvolutionUndo) {
      dependencies.track('evolution_undo', marker.props);
      undoMarkerRef.current = null;
    }
  }, [dependencies]);

  const previewCandidateById = useCallback(
    (candidateId: string) => {
      const candidate = activeSection?.candidates.find(
        (item) => item.candidate.id === candidateId,
      )?.candidate;
      return candidate ? previewCandidate(candidate) : Promise.resolve(false);
    },
    [activeSection, previewCandidate],
  );

  const applyCandidateById = useCallback(
    (candidateId: string): EvolutionUiApplyOutcome => {
      const candidate = activeSection?.candidates.find(
        (item) => item.candidate.id === candidateId,
      )?.candidate;
      return candidate
        ? applyCandidate(candidate)
        : { status: 'REJECTED', reason: 'UNSUPPORTED_CANDIDATE' };
    },
    [activeSection, applyCandidate],
  );

  return {
    visible: enabled && visible,
    activeLevel,
    model,
    activeSection,
    sheetCandidates,
    open,
    close,
    selectLevel,
    previewOriginal,
    previewCandidate,
    previewCandidateById,
    applyCandidate,
    applyCandidateById,
    undo,
  };
}
