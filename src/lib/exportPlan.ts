/**
 * Build the video-export render plan (pure, UI/native-independent). Lays the
 * progression out in seconds and tiles it to fill `durationSec`, resolving each
 * chord's voicing (MIDI notes), function color and key-aware key labels here so the
 * native encoder only ever draws + encodes (sprint-4.md §0).
 */

import { midiNoteName } from '@/data/music';
import { chordMidiNotes } from '@/lib/voicing';
import { secondsPerBeat } from '@/services/audio/schedule';
import type { ExportPlan, ExportSegment } from '@/services/videoExport/types';
import { functionColor } from '@/theme/tokens';
import type { ChordEvent, MajorKey } from '@/types';

export type BuildExportPlanParams = {
  progression: ChordEvent[];
  key: MajorKey;
  bpm: number;
  title: string;
  durationSec: number;
  audioUri: string;
  watermark: boolean;
  width?: number;
  height?: number;
  fps?: number;
  keyboardLow?: number;
  keyboardHigh?: number;
};

/** Key label spelling for each pitch class 0..11 (♭/♯ per key). */
export function pitchClassNamesFor(key: MajorKey): string[] {
  return Array.from({ length: 12 }, (_, pc) => midiNoteName(key, pc));
}

/**
 * Tile the progression across `[0, durationSec)` in seconds. Each chord keeps its
 * beat length (converted to seconds); the final segment is clipped to the duration.
 */
export function buildSegments(
  progression: ChordEvent[],
  key: MajorKey,
  bpm: number,
  durationSec: number,
): ExportSegment[] {
  if (progression.length === 0 || durationSec <= 0) return [];
  const spb = secondsPerBeat(bpm);
  const segments: ExportSegment[] = [];
  let t = 0;
  let i = 0;
  // Guard against pathological zero-length events causing an infinite loop.
  const maxSegments = 10_000;
  while (t < durationSec && segments.length < maxSegments) {
    const ev = progression[i % progression.length];
    const full = Math.max(0.001, ev.durationBeats * spb);
    const clipped = Math.min(full, durationSec - t);
    segments.push({
      displayName: ev.displayName,
      degreeLabel: ev.degreeLabel,
      colorHex: functionColor[ev.function],
      midiNotes: chordMidiNotes(ev, key),
      startSec: t,
      durationSec: clipped,
    });
    t += full;
    i += 1;
  }
  return segments;
}

export function buildExportPlan(params: BuildExportPlanParams): ExportPlan {
  const {
    progression,
    key,
    bpm,
    title,
    durationSec,
    audioUri,
    watermark,
    width = 1080,
    height = 1920,
    fps = 30,
    keyboardLow = 36,
    keyboardHigh = 60,
  } = params;

  const totalBeats = progression.reduce((sum, e) => sum + e.durationBeats, 0);
  const bars = Math.max(1, Math.ceil(totalBeats / 4));

  return {
    width,
    height,
    fps,
    durationSec,
    audioUri,
    title,
    keyLabel: key,
    bpm,
    bars,
    watermark,
    keyboardLow,
    keyboardHigh,
    pitchClassNames: pitchClassNamesFor(key),
    segments: buildSegments(progression, key, bpm, durationSec),
  };
}
