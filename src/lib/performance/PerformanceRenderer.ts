/**
 * PerformanceRenderer — Strategy/Provider boundary between the Performance Engine
 * and concrete audio backends (sprint-6 §4.5).
 *
 * Domain code depends only on this abstract contract. The iOS native
 * implementation lives in the service layer (`NativeAudioRenderer`); a future
 * Web/Tone.js adapter would implement the same interface without touching the
 * engine. This file intentionally has no RN/Expo/native imports.
 */

import type { NoteEvent } from './NoteEvent';

/** Options shared by every Renderer when starting a performance. */
export type PerformanceRenderOptions = {
  bpm: number;
  totalBeats: number;
  loop: boolean;
};

/**
 * Plays a pre-baked `NoteEvent[]`. Events already carry microtiming, gate,
 * velocity and articulation — Renderers must not re-humanize them.
 */
export interface PerformanceRenderer {
  prepare(): Promise<void>;
  render(notes: NoteEvent[], opts: PerformanceRenderOptions): Promise<void>;
  stop(): Promise<void>;
}
