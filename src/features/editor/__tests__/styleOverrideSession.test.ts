import {
  addChord,
  appendProject,
  duplicateSelected,
  getSession,
  moveSelected,
  replaceProgressionAtomically,
  replaceSelected,
  setAccompaniment,
  setDuration,
  setSelected,
  setSelectedAccompanimentOverride,
  startNew,
  undo,
} from '@/features/editor/session';
import { chordStyleOverrideBadge } from '@/features/editor/chordStyleOverrideOptions';
import { NO_ENTITLEMENTS } from '@/lib/entitlements';
import type { ChordAccompanimentOverride, ChordEvent, Project } from '@/types';

const PRO_ENTITLEMENTS = { palettePro: true, communityPlus: false };
const CITY: ChordAccompanimentOverride = {
  pattern: 'city',
  variant: 'city.type1',
};
const ARPEGGIO: ChordAccompanimentOverride = {
  pattern: 'natural',
  variant: 'natural.type5',
};

function chord(
  displayName = 'C',
  rootOffset = 0,
): Omit<ChordEvent, 'id' | 'accompanimentOverride'> {
  return {
    chordId: displayName,
    displayName,
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix: '',
  };
}

function addAndSelect(): void {
  addChord(chord());
  setSelected(0);
}

function savedProject(override: unknown = CITY): Project {
  return {
    id: 'saved-project',
    title: 'Saved Project',
    key: 'C',
    mode: 'major',
    tempoBpm: 100,
    timeSignature: '4/4',
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: 'natural.type1',
    accompanimentEnergy: 'build',
    voicingPosition: 'root',
    chordEvents: [
      {
        ...chord(),
        id: 'saved-event',
        accompanimentOverride: override as ChordAccompanimentOverride,
      },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('single-Chord STYLE override mutation', () => {
  beforeEach(() => {
    startNew();
  });

  it('updates only the selected ChordEvent and does not propagate', () => {
    addChord(chord('C', 0));
    addChord(chord('F', 5));
    addChord(chord('G', 7));
    setSelected(1);

    expect(setSelectedAccompanimentOverride(CITY, PRO_ENTITLEMENTS)).toEqual({ updated: true });
    expect(getSession().progression.map((event) => event.accompanimentOverride)).toEqual([
      undefined,
      CITY,
      undefined,
    ]);
  });

  it('keeps an override when the Project Global STYLE changes', () => {
    addAndSelect();
    setSelectedAccompanimentOverride(CITY, PRO_ENTITLEMENTS);

    setAccompaniment('block', 'block.type1');

    expect(getSession()).toMatchObject({
      accompanimentPattern: 'block',
      accompanimentVariant: 'block.type1',
    });
    expect(getSession().progression[0]?.accompanimentOverride).toEqual(CITY);
  });

  it('blocks Free creation and changes without adding history', () => {
    addAndSelect();
    const historyBefore = getSession().history.length;

    expect(setSelectedAccompanimentOverride(CITY, NO_ENTITLEMENTS)).toEqual({
      updated: false,
      blockedBy: 'palettePro',
    });
    expect(getSession().progression[0]?.accompanimentOverride).toBeUndefined();
    expect(getSession().history).toHaveLength(historyBefore);

    setSelectedAccompanimentOverride(CITY, PRO_ENTITLEMENTS);
    const grandfatheredHistory = getSession().history.length;
    expect(setSelectedAccompanimentOverride(ARPEGGIO, NO_ENTITLEMENTS)).toEqual({
      updated: false,
      blockedBy: 'palettePro',
    });
    expect(getSession().progression[0]?.accompanimentOverride).toEqual(CITY);
    expect(getSession().history).toHaveLength(grandfatheredHistory);
  });

  it('allows Free to remove a grandfathered override and Undo restores it', () => {
    addAndSelect();
    setSelectedAccompanimentOverride(CITY, PRO_ENTITLEMENTS);

    expect(setSelectedAccompanimentOverride(undefined, NO_ENTITLEMENTS)).toEqual({ updated: true });
    expect(getSession().progression[0]).not.toHaveProperty('accompanimentOverride');

    undo();
    expect(getSession().progression[0]?.accompanimentOverride).toEqual(CITY);
  });

  it.each([
    ['non-public arpeggio', { pattern: 'arpeggio', variant: 'arpeggio.type1' }],
    ['mismatched variant', { pattern: 'block', variant: 'city.type1' }],
    ['unknown variant', { pattern: 'natural', variant: 'natural.type99' }],
  ])('rejects %s without mutating history', (_label, override) => {
    addAndSelect();
    const historyBefore = getSession().history.length;

    expect(
      setSelectedAccompanimentOverride(override as ChordAccompanimentOverride, PRO_ENTITLEMENTS),
    ).toEqual({ updated: false, invalidStyle: true });
    expect(getSession().progression[0]).not.toHaveProperty('accompanimentOverride');
    expect(getSession().history).toHaveLength(historyBefore);
  });
});

describe('override follows chord editing operations', () => {
  beforeEach(() => {
    startNew();
    addAndSelect();
    setSelectedAccompanimentOverride(CITY, PRO_ENTITLEMENTS);
  });

  it('duplicate copies the override', () => {
    duplicateSelected();

    expect(getSession().progression).toHaveLength(2);
    expect(getSession().progression.map((event) => event.accompanimentOverride)).toEqual([
      CITY,
      CITY,
    ]);
    expect(
      getSession().progression.map((event) => chordStyleOverrideBadge(event.accompanimentOverride)),
    ).toEqual(['City', 'City']);
  });

  it('move carries the override with its ChordEvent', () => {
    addChord(chord('G', 7));
    setSelected(0);

    moveSelected(1);

    expect(getSession().selected).toBe(1);
    expect(getSession().progression[0]?.accompanimentOverride).toBeUndefined();
    expect(getSession().progression[1]?.accompanimentOverride).toEqual(CITY);
    expect(
      getSession().progression.map((event) => chordStyleOverrideBadge(event.accompanimentOverride)),
    ).toEqual([undefined, 'City']);
  });

  it('replace and duration changes preserve the override', () => {
    replaceSelected(chord('F', 5));
    setDuration(2);

    expect(getSession().progression[0]).toMatchObject({
      displayName: 'F',
      durationBeats: 2,
      accompanimentOverride: CITY,
    });
  });

  it('Undo restores the exact override state', () => {
    setSelectedAccompanimentOverride(ARPEGGIO, PRO_ENTITLEMENTS);
    expect(getSession().progression[0]?.accompanimentOverride).toEqual(ARPEGGIO);

    undo();

    expect(getSession().progression[0]?.accompanimentOverride).toEqual(CITY);
  });

  it('atomic harmony replacement preserves the existing override authority', () => {
    const current = getSession().progression;
    const attempted = current.map((event) => ({
      ...event,
      displayName: 'F',
      rootOffset: 5,
      accompanimentOverride: ARPEGGIO,
    }));

    expect(replaceProgressionAtomically(current, attempted)).toBe(true);
    expect(getSession().progression[0]).toMatchObject({
      displayName: 'F',
      rootOffset: 5,
      accompanimentOverride: CITY,
    });
  });
});

describe('saved override grandfathering on append', () => {
  beforeEach(() => {
    startNew();
  });

  it('preserves a valid saved override for Free', () => {
    const result = appendProject(savedProject());

    expect(result).toEqual({ appended: 1, dropped: 0 });
    expect(getSession().progression[0]?.accompanimentOverride).toEqual(CITY);
  });

  it('drops an invalid saved override to Global inheritance', () => {
    const result = appendProject(
      savedProject({
        pattern: 'arpeggio',
        variant: 'arpeggio.type1',
      }),
    );

    expect(result).toEqual({ appended: 1, dropped: 0 });
    expect(getSession().progression[0]).not.toHaveProperty('accompanimentOverride');
  });
});
