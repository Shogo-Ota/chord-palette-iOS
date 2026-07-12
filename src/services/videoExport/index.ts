import type { EventSubscription } from 'expo-modules-core';

import { ChordVideoExportNative } from '@modules/chord-video-export';
import { buildExportPlan } from '@/lib/exportPlan';
import { progressionToChordSpecs } from '@/lib/voicing';
import { VideoExportError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { audioService } from '@/services/audio';
import { buildProgression } from '@/services/audio/schedule';
import type { ChordEvent, MajorKey } from '@/types';

/** Minimal snapshot the exporter needs (decoupled from the editor feature layer). */
export type VideoExportInput = {
  title: string;
  key: MajorKey;
  bpm: number;
  progression: ChordEvent[];
  grooveId: string;
  instrumentId: string;
};

export type VideoExportOptions = {
  /** Clip length in seconds (15 | 30 | 60). */
  durationSec: number;
  watermark: boolean;
  /** Optional 0..1 encode progress. */
  onProgress?: (progress: number) => void;
};

function isAvailable(): boolean {
  return (
    !!ChordVideoExportNative && ChordVideoExportNative.isAvailable() && audioService.isAvailable()
  );
}

export const videoExportService = {
  isAvailable,

  /**
   * Full export pipeline: offline-render the audio, build the render plan, encode
   * the MP4 natively, and save it to the photo library. Returns the saved MP4 URI.
   */
  async exportAndSave(input: VideoExportInput, opts: VideoExportOptions): Promise<string> {
    if (!ChordVideoExportNative || !ChordVideoExportNative.isAvailable()) {
      throw new VideoExportError('動画書き出しはこのビルドで利用できません。開発ビルドで再度お試しください。');
    }

    // 1) Offline-render the deterministic audio track.
    const specs = progressionToChordSpecs(input.progression, input.key);
    const { chordEvents, totalBeats } = buildProgression(specs);
    if (totalBeats <= 0) {
      throw new VideoExportError('コードがありません。動画を書き出す前に進行を作成してください。');
    }
    const audio = await audioService.renderAudioFile({
      bpm: input.bpm,
      totalBeats,
      chordEvents,
      drumPatternId: input.grooveId,
      instrument: input.instrumentId,
      durationSec: opts.durationSec,
    });
    if (!audio) {
      throw new VideoExportError('音声のレンダリングに失敗しました。');
    }

    // 2) Build the render plan and (optionally) subscribe to encode progress.
    const plan = buildExportPlan({
      progression: input.progression,
      key: input.key,
      bpm: input.bpm,
      title: input.title,
      durationSec: opts.durationSec,
      audioUri: audio.uri,
      watermark: opts.watermark,
    });

    let sub: EventSubscription | null = null;
    if (opts.onProgress) {
      sub = ChordVideoExportNative.addListener('onProgress', (e) => opts.onProgress?.(e.progress));
    }

    try {
      // 3) Encode the MP4 natively.
      const { uri } = await ChordVideoExportNative.exportVideo(plan);

      // 4) Save to the photo library (add-only permission).
      // Lazy-load expo-media-library so a build without the native module doesn't
      // crash at import time — only the export flow is disabled, not the whole app.
      const MediaLibrary = await import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        throw new VideoExportError('写真ライブラリへの保存が許可されていません。設定から許可してください。');
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      return uri;
    } catch (e) {
      logger.error('Video export failed', { error: String(e) });
      if (e instanceof VideoExportError) throw e;
      throw new VideoExportError('動画の書き出しに失敗しました。', { cause: e });
    } finally {
      sub?.remove();
    }
  },
};
