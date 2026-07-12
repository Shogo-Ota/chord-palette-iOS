import type { EventSubscription } from 'expo-modules-core';

import { ChordAudioNative } from '@modules/chord-audio';
import { getVolumeLevels, setVolumeLevel } from '@/repositories/settingsRepository';
import { clampVolume } from '@/services/audio/schedule';
import type {
  PlaybackRequest,
  PlaybackState,
  PositionEvent,
  PreviewRequest,
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

  async prepare(): Promise<void> {
    if (!ChordAudioNative) return;
    await ChordAudioNative.prepare();
    await this.restoreVolumes();
  },

  async teardown(): Promise<void> {
    await ChordAudioNative?.teardown();
  },

  async previewChord(req: PreviewRequest): Promise<void> {
    await ChordAudioNative?.previewChord(req);
  },

  async play(req: PlaybackRequest): Promise<void> {
    await ChordAudioNative?.play(req);
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

  /** Set a channel volume: apply to native immediately, then persist to SQLite. */
  async setVolume(channel: VolumeChannel, value: number): Promise<void> {
    const v = clampVolume(value);
    cachedVolumes = { ...(cachedVolumes ?? { master: 1, chord: 1, drum: 1 }), [channel]: v };
    applyVolumeToNative(channel, v);
    await setVolumeLevel(channel, v);
  },

  addPositionListener(cb: (event: PositionEvent) => void): EventSubscription | null {
    return ChordAudioNative?.addListener('onPosition', cb) ?? null;
  },

  addStateListener(cb: (event: StateChangeEvent) => void): EventSubscription | null {
    return ChordAudioNative?.addListener('onStateChange', cb) ?? null;
  },
};
