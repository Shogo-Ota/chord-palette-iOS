import { compareCompatibility } from '@/lib/comparison';

import { chord, comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';

function qualityVariant(indices: readonly number[] = [2]) {
  return comparisonSource().progression.map((event, index) =>
    indices.includes(index)
      ? {
          ...event,
          chordId: `${event.rootOffset}:minor`,
          displayName: `${event.displayName}m`,
          suffix: 'm',
          definitionId: 'minor',
        }
      : event,
  );
}

describe('compareCompatibility', () => {
  it('accepts aligned equal-length replacement snapshots', () => {
    const result = compareCompatibility(snapshot(), snapshot({ progression: qualityVariant() }));

    expect(result).toMatchObject({
      supported: true,
      alignment: 'one-to-one',
      totalBeats: 16,
      copyKey: 'single-change',
    });
    if (result.supported) {
      expect(result.changes).toHaveLength(1);
    }
  });

  it('uses truthful multi-change copy for more than one audible change', () => {
    expect(
      compareCompatibility(snapshot(), snapshot({ progression: qualityVariant([0, 2]) })),
    ).toMatchObject({
      supported: true,
      copyKey: 'multi-change',
    });
  });

  it('rejects identical and notation-only pairs as musically identical', () => {
    expect(compareCompatibility(snapshot(), snapshot())).toEqual({
      supported: false,
      reason: 'IDENTICAL',
    });
    const notation = comparisonSource().progression.map((event, index) =>
      index === 0 ? { ...event, displayName: 'B♯', chordId: 'spelled-C' } : event,
    );
    expect(compareCompatibility(snapshot(), snapshot({ progression: notation }))).toEqual({
      supported: false,
      reason: 'IDENTICAL',
    });
  });

  it('rejects a duration-preserving insertion as outside Compare V1', () => {
    const source = comparisonSource();
    const progression = [
      { ...source.progression[0]!, durationBeats: 2 as const },
      chord('inserted', 'Cmaj7', 0, 'maj7', 'maj7'),
      ...source.progression.slice(1),
    ];
    progression[1] = { ...progression[1]!, durationBeats: 2 as const };

    expect(compareCompatibility(snapshot(), snapshot({ progression }))).toEqual({
      supported: false,
      reason: 'INSERTION_NOT_V1',
    });
  });

  it.each([
    ['MISSING_BASE', null, snapshot()],
    [
      'SOURCE_PROJECT_MISMATCH',
      snapshot(),
      snapshot({
        sourceProjectId: 'another-project',
        progression: qualityVariant(),
      }),
    ],
    ['TEMPO_MISMATCH', snapshot(), snapshot({ tempoBpm: 120, progression: qualityVariant() })],
    ['KEY_MISMATCH', snapshot(), snapshot({ key: 'D', progression: qualityVariant() })],
    [
      'METER_MISMATCH',
      snapshot(),
      snapshot({ accompanimentPattern: 'waltz', progression: qualityVariant() }),
    ],
    [
      'AUDIO_SETTING_MISMATCH',
      snapshot(),
      snapshot({ accompanimentEnergy: 'chorus', progression: qualityVariant() }),
    ],
    [
      'DURATION_MISMATCH',
      snapshot(),
      snapshot({
        progression: qualityVariant().map((event, index) =>
          index === 0 ? { ...event, durationBeats: 2 as const } : event,
        ),
      }),
    ],
    [
      'UNSUPPORTED_EVENT',
      snapshot(),
      snapshot({
        progression: qualityVariant().map((event, index) =>
          index === 2 ? { ...event, voicingPosition: 'first' as const } : event,
        ),
      }),
    ],
  ])('returns %s without coercing the input', (reason, base, variant) => {
    expect(compareCompatibility(base, variant)).toEqual({
      supported: false,
      reason,
    });
  });
});
