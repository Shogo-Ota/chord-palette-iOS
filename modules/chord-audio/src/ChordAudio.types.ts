import type { EventSubscription } from 'expo-modules-core';

import type {
  PlaybackRequest,
  PlaybackState,
  PositionEvent,
  PreviewRequest,
  StateChangeEvent,
} from '@/services/audio/types';

/** Events emitted by the native engine. `onPosition` is UI-only (§4.2). */
export type ChordAudioEvents = {
  onPosition: (event: PositionEvent) => void;
  onStateChange: (event: StateChangeEvent) => void;
};

/**
 * Native module surface for the Swift audio engine (`modules/chord-audio`).
 * Kept in sync with `ios/ChordAudioModule.swift`. Play/pause/resume/stop follow
 * the PlaybackState machine defined in docs/sprints/sprint-2.md §3.1.
 */
export interface ChordAudioNativeModule {
  isAvailable(): boolean;
  getVersion(): string;
  getState(): PlaybackState;

  prepare(): Promise<void>;
  teardown(): Promise<void>;

  previewChord(req: PreviewRequest): Promise<void>;

  play(req: PlaybackRequest): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;

  setMasterVolume(value: number): void;
  setChordVolume(value: number): void;
  setDrumVolume(value: number): void;

  // Inherited from expo-modules-core `NativeModule`/`EventEmitter` at runtime.
  addListener<E extends keyof ChordAudioEvents>(
    eventName: E,
    listener: ChordAudioEvents[E],
  ): EventSubscription;
  removeAllListeners(eventName: keyof ChordAudioEvents): void;
}
