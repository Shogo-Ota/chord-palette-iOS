/**
 * Lightweight app preferences in SQLite `app_meta` (no new native deps).
 * Used for "resume last session" (sprint-7 Phase D) and playback prefs.
 */

import { getDb } from '@/lib/db';

const LAST_PROJECT_KEY = 'last_project_id';
const RELEASE_CUT_KEY = 'release_cut';
const ADMIN_MODE_KEY = 'admin_mode';
const OCTAVE_SHIFT_KEY = 'octave_shift';
const EDITOR_TUTORIAL_KEY = 'editor_tutorial_seen';

/** Default: cut piano release for tight accompaniment. */
export const DEFAULT_RELEASE_CUT = true;

/**
 * Default whole-arrangement register: raised one octave (bass floor C3). C2 felt
 * too low/muddy on device speakers; the user can drop back to 0 (original C2) via
 * the octave switch on the Style screen.
 */
export const DEFAULT_OCTAVE_SHIFT = 1;

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

/** Piano/E.Piano release-cut preference (device-level, not per project). */
export async function getReleaseCut(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [RELEASE_CUT_KEY],
  );
  if (row?.value == null) return DEFAULT_RELEASE_CUT;
  return row.value === '1' || row.value === 'true';
}

export async function setReleaseCutPref(enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    RELEASE_CUT_KEY,
    enabled ? '1' : '0',
  ]);
}

/** Whole-arrangement octave offset preference (device-level, not per project). */
export async function getOctaveShift(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [OCTAVE_SHIFT_KEY],
  );
  if (row?.value == null) return DEFAULT_OCTAVE_SHIFT;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : DEFAULT_OCTAVE_SHIFT;
}

export async function setOctaveShiftPref(octaves: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    OCTAVE_SHIFT_KEY,
    String(octaves),
  ]);
}

/** Operator/admin mode flag (device-level). Gates preset authoring UI. */
export async function getAdminModePref(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [ADMIN_MODE_KEY],
  );
  return row?.value === '1' || row?.value === 'true';
}

export async function setAdminModePref(enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    ADMIN_MODE_KEY,
    enabled ? '1' : '0',
  ]);
}

/**
 * First-run editor coach marks: true once the user has seen (and dismissed) the
 * one-time "how to play a chord" tutorial. Device-level, shown only on first open.
 */
export async function getEditorTutorialSeen(): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [EDITOR_TUTORIAL_KEY],
  );
  return row?.value === '1' || row?.value === 'true';
}

export async function setEditorTutorialSeen(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    EDITOR_TUTORIAL_KEY,
    '1',
  ]);
}
