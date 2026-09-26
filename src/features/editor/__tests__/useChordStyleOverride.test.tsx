import { act, renderHook } from '@testing-library/react-native';

import {
  useChordStyleOverride,
  type ChordStyleOverrideDependencies,
} from '@/features/editor/useChordStyleOverride';
import type { EditorSession } from '@/features/editor/session';
import type { Entitlements } from '@/lib/entitlements';
import type { ChordEvent } from '@/types';

const FREE: Entitlements = { palettePro: false, communityPlus: false };
const PRO: Entitlements = { palettePro: true, communityPlus: false };
const CITY = { pattern: 'city' as const, variant: 'city.type1' };

function event(
  id: string,
  accompanimentOverride?: ChordEvent['accompanimentOverride'],
): ChordEvent {
  return {
    id,
    chordId: id,
    displayName: id,
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset: 0,
    suffix: '',
    ...(accompanimentOverride ? { accompanimentOverride } : {}),
  };
}

function editorSession(progression: ChordEvent[], selected = 0): EditorSession {
  return {
    projectId: null,
    title: 'Test',
    key: 'C',
    mode: 'major',
  paletteMode: 'major',
    tempoBpm: 100,
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: 'natural.type1',
    accompanimentEnergy: 'build',
    releaseCut: false,
    instrumentEffect: 'sustain',
    octaveShift: 0,
    drumMode: 'off',
    drumBeat: '8',
    progression,
    history: [],
    selected,
    dirty: false,
    loading: false,
    createdAt: 1,
  };
}

function setup(
  session: EditorSession,
  entitlements: Entitlements,
  setOverride = jest.fn(() => ({ updated: true })),
) {
  const onOpenPaywall = jest.fn();
  const dependencies: ChordStyleOverrideDependencies = {
    setSelected: jest.fn(),
    setOverride,
  };
  const hook = renderHook(
    ({
      nextSession,
      nextEntitlements,
    }: {
      nextSession: EditorSession;
      nextEntitlements: Entitlements;
    }) =>
      useChordStyleOverride({
        session: nextSession,
        entitlements: nextEntitlements,
        onOpenPaywall,
        dependencies,
      }),
    {
      initialProps: {
        nextSession: session,
        nextEntitlements: entitlements,
      },
    },
  );
  return { ...hook, onOpenPaywall, dependencies, setOverride };
}

describe('useChordStyleOverride Pro flow', () => {
  it('opens and delegates new setting, change and removal', () => {
    const source = editorSession([event('C')]);
    const { result, setOverride } = setup(source, PRO);

    act(() => result.current.open());
    expect(result.current.visible).toBe(true);

    act(() => result.current.select(CITY));
    expect(setOverride).toHaveBeenCalledWith(CITY, PRO);

    const changed = setup(editorSession([event('C', CITY)]), PRO);
    act(() => changed.result.current.open());
    act(() =>
      changed.result.current.select({
        pattern: 'natural',
        variant: 'natural.type5',
      }),
    );
    expect(changed.setOverride).toHaveBeenCalledWith(
      { pattern: 'natural', variant: 'natural.type5' },
      PRO,
    );

    const removed = setup(editorSession([event('C', CITY)]), PRO);
    act(() => removed.result.current.open());
    act(() => removed.result.current.select(undefined));
    expect(removed.setOverride).toHaveBeenCalledWith(undefined, PRO);
  });
});

describe('useChordStyleOverride Free and lapse flow', () => {
  it('sends a new Free attempt directly to Paywall', () => {
    const { result, onOpenPaywall, setOverride } = setup(editorSession([event('C')]), FREE);

    act(() => result.current.open());

    expect(result.current.visible).toBe(false);
    expect(result.current.awaitingEntitlement).toBe(true);
    expect(onOpenPaywall).toHaveBeenCalledTimes(1);
    expect(setOverride).not.toHaveBeenCalled();
  });

  it('allows a lapsed user to remove but Paywalls a different STYLE', () => {
    const remove = setup(editorSession([event('C', CITY)]), FREE);
    act(() => remove.result.current.open());
    expect(remove.result.current.visible).toBe(true);
    act(() => remove.result.current.select(undefined));
    expect(remove.setOverride).toHaveBeenCalledWith(undefined, FREE);
    expect(remove.onOpenPaywall).not.toHaveBeenCalled();

    const blocked = setup(
      editorSession([event('C', CITY)]),
      FREE,
      jest.fn(() => ({ updated: false, blockedBy: 'palettePro' as const })),
    );
    act(() => blocked.result.current.open());
    act(() =>
      blocked.result.current.select({
        pattern: 'natural',
        variant: 'natural.type5',
      }),
    );
    expect(blocked.onOpenPaywall).toHaveBeenCalledTimes(1);
    expect(blocked.result.current.awaitingEntitlement).toBe(true);
  });

  it.each(['purchase', 'restore'])(
    'reopens without auto-applying after %s entitlement succeeds',
    () => {
      const first = event('C');
      const second = event('G');
      const source = editorSession([first, second], 0);
      const flow = setup(source, FREE);
      act(() => flow.result.current.open());

      act(() =>
        flow.rerender({
          nextSession: editorSession([first, second], 1),
          nextEntitlements: PRO,
        }),
      );

      expect(flow.dependencies.setSelected).toHaveBeenCalledWith(0);
      expect(flow.result.current.visible).toBe(true);
      expect(flow.result.current.targetEvent?.id).toBe('C');
      expect(flow.setOverride).not.toHaveBeenCalled();
    },
  );

  it('reflects Undo-restored override state while the picker is open', () => {
    const flow = setup(editorSession([event('C', CITY)]), PRO);
    act(() => flow.result.current.open());
    expect(flow.result.current.targetEvent?.accompanimentOverride).toEqual(CITY);

    act(() =>
      flow.rerender({
        nextSession: editorSession([event('C')]),
        nextEntitlements: PRO,
      }),
    );
    expect(flow.result.current.targetEvent?.accompanimentOverride).toBeUndefined();
  });
});
