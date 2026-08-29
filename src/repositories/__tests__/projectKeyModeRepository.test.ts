/* eslint-disable import/first */

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => mockDb),
}));

import { createProject, getProject } from '@/repositories/projectRepository';

/** A row written before `key_mode` shipped: the column is simply absent. */
const LEGACY_ROW = {
  id: 'legacy',
  title: 'Legacy',
  key: 'C',
  tempo_bpm: 100,
  time_signature: '4/4',
  instrument_id: 'piano',
  groove_id: 'pop8',
  accompaniment_pattern: 'natural',
  accompaniment_variant: 'natural.type1',
  accompaniment_energy: 'build',
  voicing_position: 'root',
  chord_events: '[]',
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

describe('project key mode persistence', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('reads a project saved in minor back as minor', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ ...LEGACY_ROW, key_mode: 'minor' });

    await expect(getProject('legacy')).resolves.toMatchObject({ key: 'C', mode: 'minor' });
  });

  it('reads every pre-minor project as major', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(LEGACY_ROW);
    await expect(getProject('legacy')).resolves.toMatchObject({ mode: 'major' });

    mockDb.getFirstAsync.mockResolvedValueOnce({ ...LEGACY_ROW, key_mode: 'dorian' });
    await expect(getProject('legacy')).resolves.toMatchObject({ mode: 'major' });
  });

  it('writes the mode to its own column', async () => {
    await createProject({ mode: 'minor' });

    expect(insertedValue('key_mode')).toBe('minor');
  });

  it('defaults a new project to major', async () => {
    const created = await createProject();

    expect(created.mode).toBe('major');
    expect(insertedValue('key_mode')).toBe('major');
  });
});
