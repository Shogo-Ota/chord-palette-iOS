import type { EventSubscription } from 'expo-modules-core';

import { ChordVideoExportNative } from '@modules/chord-video-export';
import { buildExportPlan } from '@/lib/exportPlan';
import { buildChordStrikesPayload } from '@/lib/groove/attachStrikes';
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
  /** Accompaniment rhythm id — kept in sync with playback so audio matches. */
  accompaniment: string;
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

/**
 * Encode the MP4 to a temporary file (offline audio + native video). Does not
 * touch the photo library — callers decide whether to save and/or share.
 */
async function exportToFile(input: VideoExportInput, opts: VideoExportOptions): Promise<string> {
  if (!ChordVideoExportNative || !ChordVideoExportNative.isAvailable()) {
    throw new VideoExportError(
      '動画書き出しはこのビルドで利用できません。開発ビルドで再度お試しください。',
    );
  }

  const specs = progressionToChordSpecs(input.progression, input.key);
  const { chordEvents, totalBeats } = buildProgression(specs);
  if (totalBeats <= 0) {
    throw new VideoExportError('コードがありません。動画を書き出す前に進行を作成してください。');
  }
  const chordStrikes = buildChordStrikesPayload({
    bpm: input.bpm,
    totalBeats,
    chordEvents,
    accompaniment: input.accompaniment,
  });
  const audio = await audioService.renderAudioFile({
    bpm: input.bpm,
    totalBeats,
    chordEvents,
    drumPatternId: input.grooveId,
    accompaniment: input.accompaniment,
    instrument: input.instrumentId,
    durationSec: opts.durationSec,
    chordStrikes,
  });
  if (!audio) {
    throw new VideoExportError('音声のレンダリングに失敗しました。');
  }

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
    const { uri } = await ChordVideoExportNative.exportVideo(plan);
    return uri;
  } catch (e) {
    logger.error('Video export failed', { error: String(e) });
    if (e instanceof VideoExportError) throw e;
    throw new VideoExportError('動画の書き出しに失敗しました。', { cause: e });
  } finally {
    sub?.remove();
  }
}

async function saveToPhotos(uri: string): Promise<void> {
  // Lazy-load so a build without the native module doesn't crash at import time.
  const MediaLibrary = await import('expo-media-library');
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    throw new VideoExportError(
      '写真ライブラリへの保存が許可されていません。設定から許可してください。',
    );
  }
  await MediaLibrary.saveToLibraryAsync(uri);
}

async function share(uri: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new VideoExportError('この端末では共有シートを開けません。');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'video/mp4',
    UTI: 'public.mpeg-4',
    dialogTitle: '動画を共有',
  });
}

export const videoExportService = {
  isAvailable,
  exportToFile,
  saveToPhotos,
  share,

  /**
   * Full export pipeline: offline-render the audio, build the render plan, encode
   * the MP4 natively, and save it to the photo library. Returns the saved MP4 URI.
   */
  async exportAndSave(input: VideoExportInput, opts: VideoExportOptions): Promise<string> {
    const uri = await exportToFile(input, opts);
    try {
      await saveToPhotos(uri);
      return uri;
    } catch (e) {
      logger.error('Video save failed', { error: String(e) });
      if (e instanceof VideoExportError) throw e;
      throw new VideoExportError('動画の保存に失敗しました。', { cause: e });
    }
  },

  /** Encode then open the system share sheet (does not require photo permission). */
  async exportAndShare(input: VideoExportInput, opts: VideoExportOptions): Promise<string> {
    const uri = await exportToFile(input, opts);
    try {
      await share(uri);
      return uri;
    } catch (e) {
      logger.error('Video share failed', { error: String(e) });
      if (e instanceof VideoExportError) throw e;
      throw new VideoExportError('動画の共有に失敗しました。', { cause: e });
    }
  },
};
