import { act, renderHook } from '@testing-library/react-native';

import { applyEvolutionCandidate } from '@/features/editor/chordEvolution/apply';
import {
  diatonicEvent,
  diatonicSeventhEvent,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import {
  useChordEvolution,
  type ChordEvolutionControllerDependencies,
} from '@/features/editor/chordEvolution/useChordEvolution';
import { addChord, getSession, startNew, undo } from '@/features/editor/session';
import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

const PRO_ENTITLEMENTS: Entitlements = {
  palettePro: true,
  communityPlus: false,
};

function startProgression(): void {
  startNew();
  addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 5)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 3)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
}

function startSeventhProgression(): void {
  startNew();
  for (const degree of [0, 3, 4, 0]) {
    addChord(withoutEventId(diatonicSeventhEvent('C', 'major', degree)));
  }
}

function dependencies(): ChordEvolutionControllerDependencies & {
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
  deps: ChordEvolutionControllerDependencies,
  entitlements: Entitlements,
  onOpenPaywall = jest.fn(),
) {
  return {
    ...renderHook(() =>
      useChordEvolution({
        session: getSession(),
        entitlements,
        tier: entitlements.palettePro ? 'pro' : 'free',
        enabled: true,
        onOpenPaywall,
        dependencies: deps,
      }),
    ),
    onOpenPaywall,
  };
}

describe('useChordEvolution Reharm', () => {
  it('offers free Preview and sends locked Apply to Paywall once', async () => {
    startProgression();
    const deps = dependencies();
    const before = getSession();
    const { result, onOpenPaywall } = renderController(deps, NO_ENTITLEMENTS);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => {
      result.current.selectLevel('reharm');
      result.current.selectLevel('reharm');
    });
    expect(result.current.model?.levels.map((level) => level.label)).toEqual([
      'Original',
      '7th',
      'Rich',
      'Reharm',
    ]);
    const candidate = result.current.sheetCandidates[0];
    expect(candidate).toMatchObject({
      applyLocked: true,
      applyLabel: 'Proで適用',
    });
    expect(candidate?.rationale).toBeTruthy();

    await act(async () => {
      expect(await result.current.previewCandidateById(candidate!.id)).toBe(true);
    });
    expect(getSession()).toBe(before);
    act(() => {
      expect(result.current.applyCandidateById(candidate!.id)).toEqual({
        status: 'PAYWALL',
      });
      expect(result.current.applyCandidateById(candidate!.id)).toEqual({
        status: 'PAYWALL',
      });
    });
    expect(onOpenPaywall).toHaveBeenCalledTimes(1);
    expect(
      deps.track.mock.calls.filter(([event]) => event === 'evolution_level_previewed'),
    ).toEqual([
      [
        'evolution_level_previewed',
        {
          scope: 'progression',
          level: 'reharm',
          mode: 'major',
          requiredTier: 'PRO',
        },
      ],
    ]);
    expect(
      deps.track.mock.calls.filter(([event]) => event === 'evolution_candidate_previewed'),
    ).toHaveLength(1);
  });

  it('allows Pro Apply as one controller action', () => {
    startProgression();
    const deps = dependencies();
    const beforeHistory = getSession().history.length;
    const { result, onOpenPaywall } = renderController(deps, PRO_ENTITLEMENTS);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('reharm'));
    const candidateId = result.current.sheetCandidates[0]!.id;
    act(() => {
      expect(result.current.applyCandidateById(candidateId)).toEqual({
        status: 'APPLIED',
        historyEntriesAdded: 1,
      });
    });
    expect(getSession().history).toHaveLength(beforeHistory + 1);
    expect(onOpenPaywall).not.toHaveBeenCalled();
    expect(deps.track.mock.calls.filter(([event]) => event === 'evolution_applied')).toHaveLength(
      1,
    );
  });

  it('reports Reharm for a ranked frozen-L2 candidate', async () => {
    startSeventhProgression();
    const deps = dependencies();
    const { result } = renderController(deps, NO_ENTITLEMENTS);
    act(() => result.current.open({ kind: 'progression' }));
    act(() => result.current.selectLevel('reharm'));
    const l2Candidate = result.current.activeSection?.candidates.find(
      (viewModel) =>
        viewModel.candidate.technique === 'add_tension' ||
        viewModel.candidate.technique === 'slash_chord',
    );
    expect(l2Candidate).toBeDefined();
    await act(async () => {
      await result.current.previewCandidateById(l2Candidate!.candidate.id);
    });
    const [, props] = deps.track.mock.calls.find(
      ([event]) => event === 'evolution_candidate_previewed',
    )!;
    expect(props).toMatchObject({
      level: 'reharm',
      requiredTier: 'PRO',
      scope: 'progression',
    });
  });
});
