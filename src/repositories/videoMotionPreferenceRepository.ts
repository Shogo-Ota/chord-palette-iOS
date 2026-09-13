import { getDb } from '@/lib/db';
import type { VideoMotionPreference } from '@/lib/videoExport/comparison';

const VIDEO_MOTION_KEY = 'video_compare_motion';

export function normalizeVideoMotionPreference(value: unknown): VideoMotionPreference {
  return value === 'reduced' ? 'reduced' : 'standard';
}

export async function getVideoMotionPreference(): Promise<VideoMotionPreference> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    [VIDEO_MOTION_KEY],
  );
  return normalizeVideoMotionPreference(row?.value);
}

export async function setVideoMotionPreference(motion: VideoMotionPreference): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);', [
    VIDEO_MOTION_KEY,
    normalizeVideoMotionPreference(motion),
  ]);
}
