import type { EventSubscription } from 'expo-modules-core';

import { ChordAudioNative } from '@modules/chord-audio';
import { logger } from '@/lib/logger';
import { getVolumeLevels, setVolumeLevel } from '@/repositories/settingsRepository';
import { clampVolume } from '@/services/audio/schedule';
import type {
  AudioDiagnostics,
  PlaybackDiagnosticsSnapshot,
  PlaybackRequest,
  PlaybackState,
  PositionEvent,
  PreviewRequest,
  RenderAudioRequest,
  RenderAudioResult,
  StateChangeEvent,
  VolumeChannel,
  VolumeLevels,
} from '@/services/audio/types';

/**
 * AudioService — the single abstraction over the native audio engine. Screens
 * and features go through here so the native module is never touched directly
 * (coding rule §18) and so volume persistence stays canonical in SQLite (§5.1).
 *
 * When the native module is not linked (Expo Go / JS export), every method is a
 * safe no-op and `isAvailable()` returns false.
 */

let cachedVolumes: VolumeLevels | null = null;

export function isNativeAudioAvailable(): boolean {
  return !!ChordAudioNative && ChordAudioNative.isAvailable();
}

function applyVolumeToNative(channel: VolumeChannel, value: number): void {
  if (!ChordAudioNative) return;
  const v = clampVolume(value);
  if (channel === 'master') ChordAudioNative.setMasterVolume(v);
  else if (channel === 'chord') ChordAudioNative.setChordVolume(v);
  else ChordAudioNative.setDrumVolume(v);
}

export const audioService = {
  isAvailable: isNativeAudioAvailable,

  getVersion(): string | null {
    return ChordAudioNative?.getVersion() ?? null;
  },

  getState(): PlaybackState {
    return (ChordAudioNative?.getState() as PlaybackState | undefined) ?? 'idle';
  },

  /** Current playhead in beats. 0 when idle or when the binary lacks the API. */
  getCurrentBeat(): number {
    return ChordAudioNative?.getCurrentBeat?.() ?? 0;
  },

  async prepare(): Promise<void> {
    if (!ChordAudioNative) return;
    await ChordAudioNative.prepare();
    await this.restoreVolumes();
  },

  async teardown(): Promise<void> {
    await ChordAudioNative?.teardown();
  },

  /**
   * Fetch SoundFont resolution + sampled-load diagnostics from the native engine.
   * Returns null when the native module is unavailable (Expo Go / JS export) or
   * the running binary predates the diagnostics API.
   */
  async getDiagnostics(): Promise<AudioDiagnostics | null> {
    if (!ChordAudioNative?.getAudioDiagnostics) return null;
    return await ChordAudioNative.getAudioDiagnostics();
  },

  /**
   * Fetch diagnostics and print them to the Metro/JS console via `logger`, so the
   * synth-fallback root cause can be read (and copy-pasted) without native os_log.
   * Never throws — diagnostics must not break playback.
   */
  async logDiagnostics(reason: string): Promise<AudioDiagnostics | null> {
    try {
      const diag = await this.getDiagnostics();
      if (!diag) {
        logger.info(`[audio-diagnostics] ${reason}: native module unavailable`);
        return null;
      }
      logger.info(`[audio-diagnostics] ${reason}`, diag as unknown as Record<string, unknown>);
      return diag;
    } catch (e) {
      logger.warn(`[audio-diagnostics] ${reason}: failed`, { error: String(e) });
      return null;
    }
  },

  /**
   * Fetch the playback lifecycle timeline + polyphony stats (v1.01 Phase 1).
   * Returns null when the native module is unavailable or the binary predates
   * the API. Call AFTER a playback anomaly (e.g. "low notes only") to read back
   * the events that led up to it.
   */
  async getPlaybackDiagnostics(): Promise<PlaybackDiagnosticsSnapshot | null> {
    if (!ChordAudioNative?.getPlaybackDiagnostics) return null;
    return await ChordAudioNative.getPlaybackDiagnostics();
  },

  /**
   * Fetch playback diagnostics and print them to the Metro/JS console. Never
   * throws — diagnostics must not break playback.
   */
  async logPlaybackDiagnostics(reason: string): Promise<PlaybackDiagnosticsSnapshot | null> {
    try {
      const diag = await this.getPlaybackDiagnostics();
      if (!diag) {
        logger.info(`[playback-diagnostics] ${reason}: unavailable`);
        return null;
      }
      logger.info(`[playback-diagnostics] ${reason}`, diag as unknown as Record<string, unknown>);
      return diag;
    } catch (e) {
      logger.warn(`[playback-diagnostics] ${reason}: failed`, { error: String(e) });
      return null;
    }
  },

  async previewChord(req: PreviewRequest): Promise<void> {
    await ChordAudioNative?.previewChord(req);
  },

  async play(req: PlaybackRequest): Promise<void> {
    await ChordAudioNative?.play(req);
  },

  /**
   * Hot-swap the chord voice without restarting transport. Returns true when the
   * native binary supports the call; false means the caller should rebuild via
   * `play({ …, startBeat })` instead.
   */
  async setInstrument(instrumentId: string): Promise<boolean> {
    if (!ChordAudioNative?.setInstrument) return false;
    await ChordAudioNative.setInstrument(instrumentId);
    return true;
  },

  /**
   * Offline-render the looped progression to a temp audio file for video export.
   * Returns null when the native module is unavailable (JS export / Expo Go).
   */
  async renderAudioFile(req: RenderAudioRequest): Promise<RenderAudioResult | null> {
    return (await ChordAudioNative?.renderAudioFile(req)) ?? null;
  },

  async pause(): Promise<void> {
    await ChordAudioNative?.pause();
  },

  async resume(): Promise<void> {
    await ChordAudioNative?.resume();
  },

  async stop(): Promise<void> {
    await ChordAudioNative?.stop();
  },

  /** Load persisted volumes from SQLite and push them to the native engine. */
  async restoreVolumes(): Promise<VolumeLevels> {
    const levels = await getVolumeLevels();
    cachedVolumes = levels;
    applyVolumeToNative('master', levels.master);
    applyVolumeToNative('chord', levels.chord);
    applyVolumeToNative('drum', levels.drum);
    return levels;
  },

  getVolumes(): VolumeLevels | null {
    return cachedVolumes;
  },

  /**
   * Apply a channel volume to the native mixer immediately (no SQLite write).
   * Use while dragging a slider so 0% mutes without waiting on persistence.
   */
  setVolumeLive(channel: VolumeChannel, value: number): void {
    const v = clampVolume(value);
    cachedVolumes = { ...(cachedVolumes ?? { master: 1, chord: 1, drum: 1 }), [channel]: v };
    applyVolumeToNative(channel, v);
  },

  /** Set a channel volume: apply to native immediately, then persist to SQLite. */
  async setVolume(channel: VolumeChannel, value: number): Promise<void> {
    const v = clampVolume(value);
    this.setVolumeLive(channel, v);
    await setVolumeLevel(channel, v);
  },

  addPositionListener(cb: (event: PositionEvent) => void): EventSubscription | null {
    return ChordAudioNative?.addListener('onPosition', cb) ?? null;
  },

  addStateListener(cb: (event: StateChangeEvent) => void): EventSubscription | null {
    return ChordAudioNative?.addListener('onStateChange', cb) ?? null;
  },
};
