/**
 * Lightweight app preferences in SQLite `app_meta` (no new native deps).
 * Used for "resume last session" (sprint-7 Phase D).
 */

import { getDb } from '@/lib/db';

const LAST_PROJECT_KEY = 'last_project_id';

export async function getLastProjectId(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [LAST_PROJECT_KEY],
  );
  return row?.value ?? null;
}

export async function setLastProjectId(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    LAST_PROJECT_KEY,
    id,
  ]);
}

export async function clearLastProjectId(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM app_meta WHERE key = ?;`, [LAST_PROJECT_KEY]);
}
