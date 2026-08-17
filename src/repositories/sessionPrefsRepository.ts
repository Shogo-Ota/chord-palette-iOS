/**
 * Lightweight app preferences in SQLite `app_meta` (no new native deps).
 * Used for "resume last session" (sprint-7 Phase D) and playback prefs.
 */

import { getDb } from '@/lib/db';

const LAST_PROJECT_KEY = 'last_project_id';
const RELEASE_CUT_KEY = 'release_cut';
const ADMIN_MODE_KEY = 'admin_mode';
/**
 * v1 defaulted to +1 octave before every public style shared one register
 * policy. Use a versioned key so existing installs do not restore that obsolete
 * automatic raise after the compact Base migration.
 */
const OCTAVE_SHIFT_KEY = 'octave_shift_v2';
const EDITOR_TUTORIAL_KEY = 'editor_tutorial_seen';
const DRUM_MODE_KEY = 'drum_mode';
const DRUM_BEAT_KEY = 'drum_beat';
const INSTRUMENT_EFFECT_KEY = 'instrument_effect';

/** Default drum playback: backbeat claps (2 & 4). */
export const DEFAULT_DRUM_MODE_PREF = 'clap' as const;

/** Default drum subdivision: the 8th-note kit the app has always played. */
export const DEFAULT_DRUM_BEAT_PREF = '8' as const;

/** Default: sustain (release cut off). */
export const DEFAULT_RELEASE_CUT = false;

/**
 * Neutral compact register: LH C2–C3 and RH C3–C5. Register is independent of
 * inversion; a future explicit user choice may still raise this by one octave.
 */
export const DEFAULT_OCTAVE_SHIFT = 0;

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

/** Drum mode preference (device-level): off | clap | full. Stored `kick` → clap. */
export async function getDrumMode(): Promise<'off' | 'clap' | 'full'> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [DRUM_MODE_KEY],
  );
  const v = row?.value;
  if (v === 'off' || v === 'clap' || v === 'full') return v;
  if (v === 'kick') return 'clap';
  return DEFAULT_DRUM_MODE_PREF;
}

export async function setDrumModePref(mode: 'off' | 'clap' | 'full'): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    DRUM_MODE_KEY,
    mode,
  ]);
}

/**
 * Piano effect preference (device-level): sustain | releaseCut.
 * Stored `off` is treated as sustain — off is no longer a product option.
 */
export async function getInstrumentEffect(): Promise<'sustain' | 'releaseCut'> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [INSTRUMENT_EFFECT_KEY],
  );
  const v = row?.value;
  if (v === 'releaseCut') return 'releaseCut';
  if (v === 'sustain' || v === 'off') return 'sustain';
  return (await getReleaseCut()) ? 'releaseCut' : 'sustain';
}

export async function setInstrumentEffectPref(
  effect: 'off' | 'sustain' | 'releaseCut',
): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    INSTRUMENT_EFFECT_KEY,
    effect,
  ]);
  // Keep the legacy flag in step for anything still reading it.
  await setReleaseCutPref(effect !== 'sustain');
}

/** Drum subdivision preference (device-level): 8 | 16 | 3. Stored `4` → 8. */
export async function getDrumBeat(): Promise<'8' | '16' | '3'> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?;`,
    [DRUM_BEAT_KEY],
  );
  const v = row?.value;
  if (v === '8' || v === '16' || v === '3') return v;
  if (v === '4') return '8';
  return DEFAULT_DRUM_BEAT_PREF;
}

export async function setDrumBeatPref(beat: '8' | '16' | '3'): Promise<void> {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    DRUM_BEAT_KEY,
    beat,
  ]);
}
