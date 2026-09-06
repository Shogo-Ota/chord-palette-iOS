import { getDb } from '@/lib/db';
import {
  normalizeVideoVisualStyle,
  type VideoVisualStyle,
} from '@/services/videoExport/videoVisualStyle';

const VIDEO_VISUAL_STYLE_KEY = 'video_visual_style';

export async function getVideoVisualStylePreference(): Promise<VideoVisualStyle> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?;',
    [VIDEO_VISUAL_STYLE_KEY],
  );
  return normalizeVideoVisualStyle(row?.value);
}

export async function setVideoVisualStylePreference(visualStyle: VideoVisualStyle): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);', [
    VIDEO_VISUAL_STYLE_KEY,
    visualStyle,
  ]);
}
