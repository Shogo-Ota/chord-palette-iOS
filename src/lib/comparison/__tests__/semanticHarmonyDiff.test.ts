import { semanticHarmonyDiff } from '@/lib/comparison';

import { chord, comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';

describe('semanticHarmonyDiff', () => {
  it('identifies a quality replacement from normalized chord fields', () => {
    const base = snapshot();
    const progression = comparisonSource().progression.map((event, index) =>
      index === 2
        ? {
            ...event,
            chordId: '5:minor',
            displayName: 'Fm',
            suffix: 'm',
            definitionId: 'minor',
          }
        : event,
    );
    const changes = semanticHarmonyDiff(base, snapshot({ progression }));

    expect(changes).toEqual([
      expect.objectContaining({
        kind: 'replace',
        baseIndex: 2,
        variantIndex: 2,
        changedFields: ['quality'],
        summaryKey: 'replace-chord',
      }),
    ]);
  });

  it('separates extension, slash bass and duration fields', () => {
    const base = snapshot();
    const progression = comparisonSource().progression.map((event, index) => {
      if (index === 0) {
        return {
          ...event,
          chordId: '0:maj7',
          displayName: 'Cmaj7',
          suffix: 'maj7',
          definitionId: 'maj7',
        };
      }
      if (index === 1) return { ...event, bassOffset: 4, bassNote: 'E' };
      if (index === 2) return { ...event, durationBeats: 2 as const };
      return { ...event, durationBeats: 4 as const };
    });

    expect(semanticHarmonyDiff(base, snapshot({ progression }))).toEqual([
      expect.objectContaining({ baseIndex: 0, changedFields: ['extension'] }),
      expect.objectContaining({
        baseIndex: 1,
        changedFields: ['bass'],
        summaryKey: 'replace-bass',
      }),
      expect.objectContaining({
        baseIndex: 2,
        changedFields: ['duration'],
        summaryKey: 'replace-duration',
      }),
    ]);
  });

  it('classifies enharmonic/display-only spelling as notation-only', () => {
    const base = snapshot();
    const progression = comparisonSource().progression.map((event, index) =>
      index === 0
        ? {
            ...event,
            chordId: 'spelled-C',
            displayName: 'B♯',
            degreeLabel: '♯VII',
            rootSpelling: { degreeIndex: 6, alteration: 1 as const },
          }
        : event,
    );

    expect(semanticHarmonyDiff(base, snapshot({ progression }))).toEqual([
      expect.objectContaining({
        kind: 'notation-only',
        changedFields: [],
        summaryKey: 'notation-only',
      }),
    ]);
  });

  it('does not collapse two unknown chord symbols into a notation-only change', () => {
    const baseProgression = comparisonSource().progression.map((event, index) =>
      index === 0 ? { ...event, suffix: 'futureA', definitionId: undefined } : event,
    );
    const variantProgression = baseProgression.map((event, index) =>
      index === 0 ? { ...event, suffix: 'futureB', displayName: 'CfutureB' } : event,
    );

    expect(
      semanticHarmonyDiff(
        snapshot({ progression: baseProgression }),
        snapshot({ progression: variantProgression }),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: 'replace',
        changedFields: ['quality'],
      }),
    ]);
  });

  it('keeps insertion/removal identities and deterministic base-then-insert ordering', () => {
    const base = snapshot();
    const source = comparisonSource();
    const progression = [
      source.progression[0]!,
      chord('inserted', 'Dm', 2, 'm', 'minor'),
      source.progression[2]!,
      source.progression[3]!,
    ];
    const changes = semanticHarmonyDiff(base, snapshot({ progression }));

    expect(
      changes.map((change) => [change.kind, change.baseEventId, change.variantEventId]),
    ).toEqual([
      ['remove', 'c2', null],
      ['insert', null, 'inserted'],
    ]);
    expect(Object.isFrozen(changes)).toBe(true);
    expect(changes.every(Object.isFrozen)).toBe(true);
  });
});
