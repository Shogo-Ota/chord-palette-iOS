import { getDb } from '@/lib/db';
import { VOLUME_DEFAULTS, type VolumeChannel, type VolumeLevels } from '@/services/audio/types';

/**
 * Canonical persistence for audio volumes (sprint-2.md §5.1). Values live in the
 * `app_meta` table (TypeScript/SQLite is the source of truth); the native engine
 * only holds the runtime value and never persists on its own.
 */

const KEYS: Record<VolumeChannel, string> = {
  master: 'volume_master',
  chord: 'volume_chord',
  drum: 'volume_drum',
};

function parseLevel(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export async function getVolumeLevels(): Promise<VolumeLevels> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM app_meta WHERE key IN (?, ?, ?);`,
    [KEYS.master, KEYS.chord, KEYS.drum],
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    master: parseLevel(map.get(KEYS.master), VOLUME_DEFAULTS.master),
    chord: parseLevel(map.get(KEYS.chord), VOLUME_DEFAULTS.chord),
    drum: parseLevel(map.get(KEYS.drum), VOLUME_DEFAULTS.drum),
  };
}

export async function setVolumeLevel(channel: VolumeChannel, value: number): Promise<void> {
  const db = await getDb();
  const clamped = Math.min(1, Math.max(0, value));
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [
    KEYS[channel],
    String(clamped),
  ]);
}
