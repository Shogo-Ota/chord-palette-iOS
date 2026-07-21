/**
 * Locally-authored progression presets (operator/admin mode). Stored as a JSON
 * blob per row in SQLite `user_presets`, mirroring the projectRepository pattern.
 * These are previewed on-device; the operator ships them to all users by copying
 * the generated TS source into `src/data/presets.ts` (see src/lib/adminPreset.ts).
 */

import { getDb } from '@/lib/db';
import type { Preset } from '@/types';

type UserPresetRow = {
  id: string;
  data: string;
  created_at: number;
  updated_at: number;
};

/** All locally-authored presets, newest first. */
export async function listUserPresets(): Promise<Preset[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UserPresetRow>(
    `SELECT * FROM user_presets ORDER BY updated_at DESC;`,
  );
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.data) as Preset;
      } catch {
        return null;
      }
    })
    .filter((p): p is Preset => p != null);
}

/** Create or update a locally-authored preset (keyed by preset id). */
export async function saveUserPreset(preset: Preset): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO user_presets (id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at;`,
    [preset.id, JSON.stringify(preset), now, now],
  );
}

export async function deleteUserPreset(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM user_presets WHERE id = ?;`, [id]);
}
