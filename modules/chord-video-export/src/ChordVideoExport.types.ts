import type { EventSubscription } from 'expo-modules-core';

import type {
  ExportPlan,
  ExportProgressEvent,
  ExportVideoResult,
} from '@/services/videoExport/types';

/** Events emitted by the native encoder. */
export type ChordVideoExportEvents = {
  onProgress: (event: ExportProgressEvent) => void;
};

/**
 * Native module surface for the Swift video encoder (`modules/chord-video-export`).
 * Kept in sync with `ios/ChordVideoExportModule.swift`. It only draws + encodes;
 * all music logic (voicing/scheduling/colors) is resolved in JS and passed in the
 * plan (sprint-4.md §0).
 */
export interface ChordVideoExportNativeModule {
  isAvailable(): boolean;
  getVersion(): string;

  /** Render the plan to a temporary MP4 and resolve with its file URI. */
  exportVideo(plan: ExportPlan): Promise<ExportVideoResult>;

  // Inherited from expo-modules-core `NativeModule`/`EventEmitter` at runtime.
  addListener<E extends keyof ChordVideoExportEvents>(
    eventName: E,
    listener: ChordVideoExportEvents[E],
  ): EventSubscription;
  removeAllListeners(eventName: keyof ChordVideoExportEvents): void;
}
