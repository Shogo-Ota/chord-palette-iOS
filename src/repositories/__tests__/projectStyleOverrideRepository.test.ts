/* eslint-disable import/first */

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => mockDb),
}));

import { logger } from '@/lib/logger';
import { createProject, getProject, saveProject } from '@/repositories/projectRepository';
import type { ChordEvent } from '@/types';

const mockWarn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

const BASE_EVENT: ChordEvent = {
  id: 'event-1',
  chordId: 'C',
  displayName: 'C',
  degreeLabel: 'I',
  function: 'tonic',
  durationBeats: 4,
  isPro: false,
  rootOffset: 0,
  suffix: '',
};

const BASE_ROW = {
  id: 'project-1',
  title: 'Project',
  key: 'C',
  key_mode: 'major',
  tempo_bpm: 100,
  time_signature: '4/4',
  instrument_id: 'piano',
  groove_id: 'pop8',
  accompaniment_pattern: 'natural',
  accompaniment_variant: 'natural.type1',
  accompaniment_energy: 'build',
  voicing_position: 'root',
  chord_events: JSON.stringify([BASE_EVENT]),
  created_at: 1,
  updated_at: 2,
};

function insertedValue(column: string): unknown {
  const [sql, values] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
  const columns = String(sql)
    .match(/\(([^)]*)\)\s*VALUES/)![1]!
    .split(',')
    .map((name) => name.trim());
  const index = columns.indexOf(column);
  if (index < 0) throw new Error(`insert does not bind a column named ${column}`);
  return values[index];
}

describe('per-chord STYLE persistence', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
    mockWarn.mockReset();
  });

  it('loads an old Project with no override as Global inheritance', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(BASE_ROW);

    const project = await getProject('project-1');

    expect(project?.chordEvents[0]).not.toHaveProperty('accompanimentOverride');
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('round-trips a valid public override from chord_events JSON', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ...BASE_ROW,
      chord_events: JSON.stringify([
        {
          ...BASE_EVENT,
          accompanimentOverride: {
            pattern: 'natural',
            variant: 'natural.type5',
          },
        },
      ]),
    });

    await expect(getProject('project-1')).resolves.toMatchObject({
      chordEvents: [
        {
          accompanimentOverride: {
            pattern: 'natural',
            variant: 'natural.type5',
          },
        },
      ],
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it.each([
    ['non-public arpeggio', { pattern: 'arpeggio', variant: 'arpeggio.type1' }],
    ['wrong-pattern variant', { pattern: 'block', variant: 'city.type1' }],
    ['unknown variant', { pattern: 'natural', variant: 'natural.type99' }],
    ['malformed value', 'natural.type1'],
  ])('removes %s and reports the fallback', async (_label, override) => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ...BASE_ROW,
      chord_events: JSON.stringify([{ ...BASE_EVENT, accompanimentOverride: override }]),
    });

    const project = await getProject('project-1');

    expect(project?.chordEvents[0]).not.toHaveProperty('accompanimentOverride');
    expect(mockWarn).toHaveBeenCalledWith(
      'Invalid per-chord accompaniment override; inheriting Global STYLE.',
      expect.objectContaining({
        projectId: 'project-1',
        eventId: 'event-1',
      }),
    );
  });

  it('stores valid overrides in the existing chord_events JSON column', async () => {
    const created = await createProject({
      chordEvents: [
        {
          ...BASE_EVENT,
          accompanimentOverride: {
            pattern: 'city',
            variant: 'city.type1',
          },
        },
      ],
    });

    expect(created.chordEvents[0]?.accompanimentOverride).toEqual({
      pattern: 'city',
      variant: 'city.type1',
    });
    expect(JSON.parse(String(insertedValue('chord_events')))).toMatchObject([
      {
        accompanimentOverride: {
          pattern: 'city',
          variant: 'city.type1',
        },
      },
    ]);
  });

  it('keeps a valid override when an existing Project is saved again', async () => {
    const created = await createProject({
      chordEvents: [
        {
          ...BASE_EVENT,
          accompanimentOverride: {
            pattern: 'natural',
            variant: 'natural.type5',
          },
        },
      ],
    });
    mockDb.runAsync.mockClear();

    const saved = await saveProject(created);

    expect(saved.chordEvents[0]?.accompanimentOverride).toEqual({
      pattern: 'natural',
      variant: 'natural.type5',
    });
    expect(JSON.parse(String(insertedValue('chord_events')))[0]).toMatchObject({
      accompanimentOverride: {
        pattern: 'natural',
        variant: 'natural.type5',
      },
    });
  });

  it('does not persist an invalid override supplied to createProject', async () => {
    const created = await createProject({
      chordEvents: [
        {
          ...BASE_EVENT,
          accompanimentOverride: {
            pattern: 'arpeggio',
            variant: 'arpeggio.type1',
          },
        },
      ],
    });

    expect(created.chordEvents[0]).not.toHaveProperty('accompanimentOverride');
    expect(JSON.parse(String(insertedValue('chord_events')))[0]).not.toHaveProperty(
      'accompanimentOverride',
    );
    expect(mockWarn).toHaveBeenCalled();
  });
});
