import { act, renderHook } from '@testing-library/react-native';

import { applyEvolutionCandidate } from '@/features/editor/chordEvolution/apply';
import { sessionToEvolutionContext } from '@/features/editor/chordEvolution/chordEventAdapter';
import {
  clearComparisonDraft,
  getComparisonDraft,
  resolveComparisonDraft,
} from '@/features/editor/chordEvolution/comparisonDraftStore';
import {
  diatonicEvent,
  diatonicSeventhEvent,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import { addChord, getSession, setSelected, startNew, undo } from '@/features/editor/session';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

import { useChordEvolution, type ChordEvolutionControllerDependencies } from '../useChordEvolution';

const PRO_ENTITLEMENTS: Entitlements = {
  palettePro: true,
  communityPlus: false,
};

function startTriadSession(): void {
  startNew();
  addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
  setSelected(0);
}

function startSeventhSession(): void {
  startNew();
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 3)));
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 4)));
  setSelected(1);
}

function controllerDependencies(): ChordEvolutionControllerDependencies & {
  play: jest.Mock;
  stop: jest.Mock;
  track: jest.Mock;
} {
  return {
    play: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    apply: applyEvolutionCandidate,
    getSession,
    undo,
    track: jest.fn(),
  };
}

function renderController(
  dependencies: ChordEvolutionControllerDependencies,
  options: {
    enabled?: boolean;
    entitlements?: Entitlements;
    onOpenPaywall?: jest.Mock;
  } = {},
) {
  const onOpenPaywall = options.onOpenPaywall ?? jest.fn();
  const hook = renderHook(() =>
    useChordEvolution({
      session: getSession(),
      entitlements: options.entitlements ?? NO_ENTITLEMENTS,
      tier: (options.entitlements ?? NO_ENTITLEMENTS).palettePro ? 'pro' : 'free',
      enabled: options.enabled ?? true,
      onOpenPaywall,
      dependencies,
    }),
  );
  return { ...hook, onOpenPaywall };
}

describe('useChordEvolution', () => {
  beforeEach(() => clearComparisonDraft());

  it('does nothing when the Feature Flag is off', () => {
    startTriadSession();
    const dependencies = controllerDependencies();
    const { result } = renderController(dependencies, {
      enabled: false,
    });
    act(() => result.current.open({ kind: 'progression' }));
    expect(result.current.visible).toBe(false);
    expect(result.current.model).toBeNull();
    expect(dependencies.track).not.toHaveBeenCalled();
  });

  it('opens chord and progression scopes once without render-time analytics', () => {
    startTriadSession();
    const dependencies = controllerDependencies();
    const progression = renderController(dependencies);
    progression.rerender({});
    expect(dependencies.track).not.toHaveBeenCalled();

    act(() => {
      progression.result.current.open({ kind: 'progression' });
      progression.result.current.open({ kind: 'progression' });
    });
    expect(progression.result.current.model?.scope).toEqual({
      kind: 'progression',
    });
    expect(dependencies.track).toHaveBeenCalledTimes(1);

    act(() => progression.result.current.close());
    act(() => progression.result.current.open({ kind: 'chord', index: 1 }));
    expect(progression.result.current.model?.scope).toEqual({
      kind: 'chord',
      index: 1,
    });
    expect(dependencies.track).toHaveBeenCalledTimes(2);
  });

  it('previews an L1 candidate without changing progression or history', async () => {
    startTriadSession();
    const progression = getSession().progression;
    const history = getSession().history;
    const dependencies = controllerDependencies();
    const { result } = renderController(dependencies);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => {
      result.current.selectLevel('seventh');
      result.current.selectLevel('seventh');
    });
    const candidateId = result.current.sheetCandidates[0]?.id;
    expect(candidateId).toBeDefined();

    await act(async () => {
      expect(await result.current.previewCandidateById(candidateId!)).toBe(true);
    });

    expect(getSession().progression).toBe(progression);
    expect(getSession().history).toBe(history);
    expect(getComparisonDraft()).toBeNull();
    expect(dependencies.play).toHaveBeenCalledTimes(1);
    expect(
      dependencies.track.mock.calls.filter(([event]) => event === 'evolution_level_previewed'),
    ).toHaveLength(1);
    expect(
      dependencies.track.mock.calls.filter(([event]) => event === 'evolution_candidate_previewed'),
    ).toHaveLength(1);
  });

  it('allows free L2 Preview but routes locked Apply to Paywall once', async () => {
    startSeventhSession();
    const dependencies = controllerDependencies();
    const { result, onOpenPaywall } = renderController(dependencies);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('tension'));
    const candidateId = result.current.sheetCandidates[0]?.id;
    expect(candidateId).toBeDefined();
    expect(result.current.sheetCandidates[0]?.applyLocked).toBe(true);

    await act(async () => {
      await result.current.previewCandidateById(candidateId!);
    });
    const before = getSession().progression;
    act(() => {
      expect(result.current.applyCandidateById(candidateId!)).toEqual({
        status: 'PAYWALL',
      });
      expect(result.current.applyCandidateById(candidateId!)).toEqual({
        status: 'PAYWALL',
      });
    });

    expect(getSession().progression).toBe(before);
    expect(getComparisonDraft()).toBeNull();
    expect(dependencies.play).toHaveBeenCalledTimes(1);
    expect(onOpenPaywall).toHaveBeenCalledTimes(1);
    expect(
      dependencies.track.mock.calls.filter(([event]) => event === 'evolution_paywall_shown'),
    ).toHaveLength(1);
  });

  it('applies L1 for free and tracks its exact existing Undo once', () => {
    startTriadSession();
    const before = getSession().progression.map((event) => ({
      ...event,
    }));
    const dependencies = controllerDependencies();
    const { result } = renderController(dependencies);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('seventh'));
    const candidateView = result.current.activeSection?.candidates[0];
    expect(candidateView).toBeDefined();

    act(() => {
      expect(result.current.applyCandidateById(candidateView!.candidate.id)).toMatchObject({
        status: 'APPLIED',
      });
    });
    expect(
      sessionToEvolutionContext(getSession(), { kind: 'progression' }, 'seventh').progression,
    ).toEqual(candidateView!.candidate.after);
    expect(resolveComparisonDraft(getSession())).toMatchObject({
      status: 'available',
      draft: { candidateId: candidateView!.candidate.id },
    });

    act(() => result.current.undo());
    expect(getSession().progression).toEqual(before);
    expect(getComparisonDraft()).toBeNull();
    act(() => result.current.undo());
    expect(
      dependencies.track.mock.calls.filter(([event]) => event === 'evolution_undo'),
    ).toHaveLength(1);
  });

  it('allows Palette Pro to Apply L2 atomically', () => {
    startSeventhSession();
    const dependencies = controllerDependencies();
    const { result, onOpenPaywall } = renderController(dependencies, {
      entitlements: PRO_ENTITLEMENTS,
    });
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('tension'));
    const candidateView = result.current.activeSection?.candidates[0];
    expect(candidateView).toBeDefined();

    act(() => {
      expect(result.current.applyCandidateById(candidateView!.candidate.id)).toMatchObject({
        status: 'APPLIED',
      });
    });
    expect(onOpenPaywall).not.toHaveBeenCalled();
    expect(
      sessionToEvolutionContext(getSession(), { kind: 'progression' }, 'tension').progression,
    ).toEqual(candidateView!.candidate.after);
  });

  it('does not publish a Comparison Draft when Apply is rejected', () => {
    startTriadSession();
    const dependencies: ChordEvolutionControllerDependencies = {
      ...controllerDependencies(),
      apply: jest.fn(() => ({
        status: 'REJECTED' as const,
        reason: 'SESSION_CHANGED' as const,
      })),
    };
    const { result } = renderController(dependencies);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('seventh'));
    const candidateId = result.current.sheetCandidates[0]?.id;
    expect(candidateId).toBeDefined();

    act(() => {
      expect(result.current.applyCandidateById(candidateId!)).toEqual({
        status: 'REJECTED',
        reason: 'SESSION_CHANGED',
      });
    });

    expect(getComparisonDraft()).toBeNull();
  });

  it('sends only low-cardinality candidate analytics payloads', async () => {
    startSeventhSession();
    const dependencies = controllerDependencies();
    const { result } = renderController(dependencies);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('tension'));
    const candidateId = result.current.sheetCandidates[0]!.id;
    await act(async () => {
      await result.current.previewCandidateById(candidateId);
    });
    const [, props] = dependencies.track.mock.calls.find(
      ([event]) => event === 'evolution_candidate_previewed',
    )!;
    expect(Object.keys(props).sort()).toEqual([
      'level',
      'mode',
      'requiredTier',
      'scope',
      'technique',
    ]);
    expect(JSON.stringify(props)).not.toContain(candidateId);
    expect(JSON.stringify(props)).not.toContain('Cmaj');
  });
});
