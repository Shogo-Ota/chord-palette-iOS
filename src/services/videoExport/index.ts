import type { EventSubscription } from 'expo-modules-core';

import { ChordVideoExportNative } from '@modules/chord-video-export';
import { buildExportPlan } from '@/lib/exportPlan';
import type { DrumBeat } from '@/lib/drum/drumBeat';
import type { DrumMode } from '@/lib/drum/drumMode';
import { cycleDurationSec } from '@/lib/exportCycleTiming';
import type { InstrumentEffect } from '@/lib/performance/effect';
import type { VoicingPosition } from '@/lib/performance/baseVoicing/types';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { type Tier } from '@/lib/performance/tier';
import { VideoExportError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { audioService } from '@/services/audio';
import type { ChordEvent, MajorKey } from '@/types';
import { buildVideoAudioRequest } from './buildVideoAudioRequest';
import { videoPerformanceInput } from './performanceInput';
import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import { nonDiatonicCycleIndices } from '@/lib/videoExport/nonDiatonic';

import { buildVisualNoteTimeline } from './visualNoteTimeline';
import { buildCompareExportPlan, type PreparedCompareExport } from './buildCompareExportPlan';
import type { ExportPlan } from './types';
import { removeTemporaryVideoExportFile, validateExportedVideo } from './validateExportedVideo';
import type { VideoVisualStyle } from './videoVisualStyle';

export { normalizeVideoVisualStyle, VIDEO_VISUAL_STYLES } from './videoVisualStyle';
export type { VideoVisualStyle, VideoVisualStyleDefinition } from './videoVisualStyle';

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
  /** Compact inversion — mirrors playback and MIDI export. Default root. */
  voicingPosition?: VoicingPosition;
  /** Drum mode — mirrors playback so a silenced kit stays silent in the clip. */
  drumMode?: DrumMode;
  /** Drum subdivision — mirrors playback so the clip uses the kit the user heard. */
  drumBeat?: DrumBeat;
  /** Piano effect — mirrors playback so the clip rings exactly as the app did. */
  instrumentEffect?: InstrumentEffect;
  /** Monetization tier — mirrors playback humanize/strum strength (default free). */
  tier?: Tier;
  /** Visual rendering behavior. Omitted and invalid runtime values fall back to Classic. */
  visualStyle?: VideoVisualStyle;
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
    videoPerformanceInput(input),
    input.tier ?? 'free',
  );
  if (performance.totalBeats <= 0) {
    throw new VideoExportError('コードがありません。動画を書き出す前に進行を作成してください。');
  }
  // Performance output is authoritative. Recompute here instead of accepting a UI
  // duration so remetered audio, visual segments and native muxing share one boundary.
  const durationSec = cycleDurationSec(performance.totalBeats, performance.bpm);
  const visualNoteEvents =
    input.visualStyle === 'flow' ? buildVisualNoteTimeline(performance, durationSec) : undefined;
  const auraIndices =
    input.visualStyle === 'flow' ? nonDiatonicCycleIndices(input.progression) : undefined;
  // Classic is frozen on its output, so the role palette reaches Flow only and
  // `ExportSegment.colorHex` keeps resolving to the harmonic-function colour.
  const roleVisuals =
    input.visualStyle === 'flow' ? harmonicRoleVisuals(input.progression) : undefined;
  const audio = await audioService.renderAudioFile(
    buildVideoAudioRequest(performance, durationSec),
  );
  if (!audio) {
    throw new VideoExportError('音声のレンダリングに失敗しました。');
  }

  const basePlan = buildExportPlan({
    progression: input.progression,
    key: input.key,
    bpm: input.bpm,
    title: input.title,
    durationSec,
    audioUri: audio.uri,
    watermark: opts.watermark,
    octaveShift: input.octaveShift ?? 0,
    beatsPerBar: performance.beatsPerBar,
    visualStyle: input.visualStyle,
  });
  // Keep the Classic payload byte-for-byte compatible: only Flow receives the
  // note-level sidecar while Classic continues to use segment timing alone.
  const plan = visualNoteEvents ? { ...basePlan, visualNoteEvents } : basePlan;
  // The aura rides the same Flow-only seam. An empty list is dropped rather than sent,
  // so a fully diatonic progression produces the payload it always did.
  const withAura =
    auraIndices && auraIndices.length > 0
      ? { ...plan, nonDiatonicCycleIndices: auraIndices }
      : plan;
  const flowPlan = roleVisuals ? { ...withAura, harmonicRoleVisuals: roleVisuals } : withAura;

  return encodePlan(flowPlan, opts);
}

async function encodePlan(plan: ExportPlan, opts: VideoExportOptions): Promise<string> {
  if (!ChordVideoExportNative || !ChordVideoExportNative.isAvailable()) {
    throw new VideoExportError(
      '動画書き出しはこのビルドで利用できません。開発ビルドで再度お試しください。',
    );
  }
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

async function exportPreparedCompareToFile(
  prepared: PreparedCompareExport,
  opts: VideoExportOptions,
): Promise<string> {
  const uri = await encodePlan(prepared.plan, opts);
  if (!(await validateExportedVideo(uri))) {
    throw new VideoExportError('完成した動画ファイルを確認できませんでした。');
  }
  return uri;
}

export const videoExportService = {
  isAvailable,
  exportToFile,
  saveToPhotos,
  share,
  buildCompareExportPlan,
  async disposePreparedCompareExport(prepared: PreparedCompareExport): Promise<void> {
    await removeTemporaryVideoExportFile(prepared.audio.uri).catch(() => undefined);
  },

  exportPreparedCompareToFile,

  async exportPreparedCompareAndSave(
    prepared: PreparedCompareExport,
    opts: VideoExportOptions,
  ): Promise<string> {
    const uri = await exportPreparedCompareToFile(prepared, opts);
    await saveToPhotos(uri);
    return uri;
  },

  async exportPreparedCompareAndShare(
    prepared: PreparedCompareExport,
    opts: VideoExportOptions,
  ): Promise<string> {
    const uri = await exportPreparedCompareToFile(prepared, opts);
    await share(uri);
    return uri;
  },

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

export type { BuildCompareExportPlanInput, PreparedCompareExport } from './buildCompareExportPlan';
export { normalizeVideoTemplateId } from './videoTemplate';
