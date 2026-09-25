/* eslint-disable import/first */

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => mockDb),
}));

import { augmentedTriads } from '@/data/augmentedTriads';
import { createProject, getProject } from '@/repositories/projectRepository';
import type { ChordEvent } from '@/types';

function augmentedEvent(): ChordEvent {
  const chord = augmentedTriads('C', 'major')[0]!;
  return {
    id: 'aug-event',
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: true,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    rootSpelling: chord.rootSpelling,
    category: chord.category,
    keyContext: 'C',
    modeContext: 'major',
    voicingPosition: 'root',
  };
}

function insertedValue(column: string): unknown {
  const [sql, values] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
  const columns = String(sql)
    .match(/\(([^)]*)\)\s*VALUES/)![1]!
    .split(',')
    .map((name) => name.trim());
  return values[columns.indexOf(column)];
}

describe('Augmented Triad project persistence', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('stores the canonical augmented event in the existing JSON column', async () => {
    await createProject({
      key: 'C',
      mode: 'major',
      chordEvents: [augmentedEvent()],
    });

    expect(JSON.parse(String(insertedValue('chord_events')))).toEqual([
      expect.objectContaining({
        displayName: 'Caug',
        suffix: 'aug',
        definitionId: 'aug',
        category: 'augmentedTriad',
        isPro: true,
      }),
    ]);
  });

  it('reloads the canonical augmented event without a schema migration', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'aug-project',
      title: 'Augmented',
      key: 'C',
      key_mode: 'major',
      tempo_bpm: 100,
      time_signature: '4/4',
      instrument_id: 'piano',
      groove_id: 'pop8',
      accompaniment_pattern: 'block',
      accompaniment_variant: 'block.type1',
      accompaniment_energy: 'build',
      voicing_position: 'root',
      chord_events: JSON.stringify([augmentedEvent()]),
      created_at: 1,
      updated_at: 2,
    });

    await expect(getProject('aug-project')).resolves.toMatchObject({
      chordEvents: [
        {
          displayName: 'Caug',
          suffix: 'aug',
          definitionId: 'aug',
          category: 'augmentedTriad',
          isPro: true,
          voicingPosition: 'root',
        },
      ],
    });
  });
});
