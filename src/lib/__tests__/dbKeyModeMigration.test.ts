/* eslint-disable import/first */

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  // No project column exists yet, so every guarded ADD COLUMN should run.
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

import { getDb } from '@/lib/db';

describe('project schema key mode migration', () => {
  /**
   * An install that predates minor keys has no `key_mode`, and the column's DEFAULT is
   * what makes those rows read back as major instead of as an unknown mode.
   */
  it('adds a major-defaulted column so pre-minor projects read back as major', async () => {
    await getDb();

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE projects ADD COLUMN key_mode TEXT NOT NULL DEFAULT 'major';",
    );
  });
});
