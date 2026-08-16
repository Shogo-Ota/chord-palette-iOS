import type { EventSubscription } from 'expo-modules-core';

import { ChordVideoExportNative } from '@modules/chord-video-export';
import { buildExportPlan } from '@/lib/exportPlan';
import { normalizeAccompaniment } from '@/lib/accompaniment';
import { normalizeDrumBeat, type DrumBeat } from '@/lib/drum/drumBeat';
import { normalizeDrumMode, type DrumMode } from '@/lib/drum/drumMode';
import { cycleDurationSec } from '@/lib/exportCycleTiming';
import type { InstrumentEffect } from '@/lib/performance/effect';
import { normalizeEnergy } from '@/lib/performance/energy';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { type Tier } from '@/lib/performance/tier';
import { VideoExportError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { audioService } from '@/services/audio';
import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';
import type { ChordEvent, InstrumentId, MajorKey } from '@/types';

/** Minimal snapshot the exporter needs (decoupled from the editor feature layer). */
export type VideoExportInput = {
  title: string;
  key: MajorKey;
  bpm: number;
  progression: ChordEvent[];
  grooveId: string;
  /** Accompaniment rhythm id — kept in sync with playback so audio matches. */
  accompaniment: string;
  /**
   * Sub-variation of the accompaniment. Omitted = the rhythm's default reading, so
   * callers that predate variants still export the take they auditioned.
   */
  accompanimentVariant?: string;
  instrumentId: string;
  /** Piano release-cut preference — mirrors playback so export matches audition. */
  releaseCut?: boolean;
  /** Whole-arrangement octave offset — mirrors playback so export matches audition. */
  octaveShift?: number;
  /** Style × Energy — mirrors playback so export matches audition. Default build. */
  accompanimentEnergy?: string;
  /** Drum mode — mirrors playback so a silenced kit stays silent in the clip. */
  drumMode?: DrumMode;
  /** Drum subdivision — mirrors playback so the clip uses the kit the user heard. */
  drumBeat?: DrumBeat;
  /** Piano effect — mirrors playback so the clip rings exactly as the app did. */
  instrumentEffect?: InstrumentEffect;
  /** Monetization tier — mirrors playback humanize/strum strength (default free). */
  tier?: Tier;
};

export type VideoExportOptions = {
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

  // One generation pipeline for playback, MIDI and video: the clip is encoded from
  // exactly the notes the user auditioned, Human MIDI Template and Harmonic Gate
  // included.
  const performance = buildSessionPerformancePlan(
    {
      key: input.key,
      tempoBpm: input.bpm,
      grooveId: input.grooveId,
      accompanimentPattern: normalizeAccompaniment(input.accompaniment),
      accompanimentVariant: input.accompanimentVariant,
      instrumentId: input.instrumentId as InstrumentId,
      accompanimentEnergy: normalizeEnergy(input.accompanimentEnergy),
      octaveShift: input.octaveShift ?? 0,
      releaseCut: input.releaseCut !== false,
      drumMode: normalizeDrumMode(input.drumMode),
      drumBeat: normalizeDrumBeat(input.drumBeat),
      instrumentEffect: input.instrumentEffect,
      progression: input.progression,
    },
    input.tier ?? 'free',
  );
  if (performance.totalBeats <= 0) {
    throw new VideoExportError('コードがありません。動画を書き出す前に進行を作成してください。');
  }
  // Performance output is authoritative. Recompute here instead of accepting a UI
  // duration so remetered audio, visual segments and native muxing share one boundary.
  const durationSec = cycleDurationSec(performance.totalBeats, performance.bpm);
  const playback = mapPerfNotesToPlaybackRequest(performance.notes, {
    bpm: performance.bpm,
    totalBeats: performance.totalBeats,
    loop: true,
    drumPatternId: performance.drumPatternId,
    instrument: performance.instrumentId,
    beatsPerBar: performance.beatsPerBar,
    drumMode: performance.drumMode,
  });
  const audio = await audioService.renderAudioFile({
    bpm: playback.bpm,
    totalBeats: playback.totalBeats,
    chordEvents: playback.chordEvents,
    drumPatternId: playback.drumPatternId,
    accompaniment: playback.accompaniment,
    instrument: playback.instrument,
    durationSec,
    beatsPerBar: playback.beatsPerBar,
    drumMode: playback.drumMode,
  });
  if (!audio) {
    throw new VideoExportError('音声のレンダリングに失敗しました。');
  }

  const plan = buildExportPlan({
    progression: input.progression,
    key: input.key,
    bpm: input.bpm,
    title: input.title,
    durationSec,
    audioUri: audio.uri,
    watermark: opts.watermark,
    octaveShift: input.octaveShift ?? 0,
    beatsPerBar: performance.beatsPerBar,
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
