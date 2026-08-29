/* eslint-disable import/first */

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest
    .fn()
    .mockResolvedValueOnce([{ name: 'accompaniment_variant' }])
    .mockResolvedValueOnce([{ name: 'accompaniment_energy' }])
    // Every later column is reported as absent, so adding one does not starve the mock.
    .mockResolvedValue([]),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

import { getDb } from '@/lib/db';

describe('project schema voicing migration', () => {
  it('adds the root-defaulted column without rewriting existing rows', async () => {
    await getDb();

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE projects ADD COLUMN voicing_position TEXT NOT NULL DEFAULT 'root';",
    );
  });
});
