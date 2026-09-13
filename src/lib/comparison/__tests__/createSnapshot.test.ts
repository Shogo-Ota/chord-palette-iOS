import { createComparisonSnapshot, snapshotToPerformanceInput } from '@/lib/comparison';

import { comparisonSource } from '@/lib/comparison/testing/fixtures';

describe('createComparisonSnapshot', () => {
  it('deep-copies and freezes the complete performance-relevant source', () => {
    const source = comparisonSource();
    const result = createComparisonSnapshot(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.progression)).toBe(true);
    expect(result.value.progression.every(Object.isFrozen)).toBe(true);
    expect(result.value.progression).not.toBe(source.progression);
    expect(result.value.progression[0]).not.toBe(source.progression[0]);
    expect(result.value.accompanimentVariant).toBe('block.type1');
    expect(result.value.beatsPerBar).toBe(4);
    expect(JSON.stringify(result.value)).not.toContain('palettePro');
    expect(JSON.stringify(result.value)).not.toContain('entitlement');
  });

  it('is deterministic for identical music and ignores title-only edits in sourceRevision', () => {
    const first = createComparisonSnapshot(comparisonSource({ title: 'First' }));
    const second = createComparisonSnapshot(comparisonSource({ title: 'Second' }));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.sourceRevision).toBe(second.value.sourceRevision);
    expect(first.value.snapshotId).toBe(second.value.snapshotId);
  });

  it('changes its identity when a performance-relevant chord changes', () => {
    const source = comparisonSource();
    const changed = source.progression.map((event, index) =>
      index === 2 ? { ...event, suffix: 'm', definitionId: 'minor' } : event,
    );
    const first = createComparisonSnapshot(source);
    const second = createComparisonSnapshot(comparisonSource({ progression: changed }));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.sourceRevision).not.toBe(second.value.sourceRevision);
  });

  it('returns a detached mutable Performance input without changing the snapshot', () => {
    const result = createComparisonSnapshot(comparisonSource());
    if (!result.ok) throw new Error(result.reason);

    const performance = snapshotToPerformanceInput(result.value);
    expect(performance.progression).toEqual(result.value.progression);
    expect(performance.progression).not.toBe(result.value.progression);
    performance.progression[0]!.displayName = 'changed';
    expect(result.value.progression[0]!.displayName).toBe('C');
  });

  it.each([
    ['INVALID_BPM', comparisonSource({ tempoBpm: Number.NaN })],
    ['EMPTY_PROGRESSION', comparisonSource({ progression: [] })],
    ['INVALID_SETTING', comparisonSource({ accompanimentPattern: 'not-a-pattern' as never })],
    [
      'DUPLICATE_EVENT_ID',
      comparisonSource({
        progression: comparisonSource().progression.map((event, index) => ({
          ...event,
          id: index < 2 ? 'duplicate' : event.id,
        })),
      }),
    ],
  ])('rejects malformed input with %s', (reason, source) => {
    expect(createComparisonSnapshot(source)).toMatchObject({
      ok: false,
      reason,
    });
  });
});
