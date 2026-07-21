/**
 * Build the video-export render plan (pure, UI/native-independent). Lays the
 * progression out in seconds and tiles it to fill `durationSec`, resolving each
 * chord's voicing (MIDI notes), function color and key-aware key labels here so the
 * native encoder only ever draws + encodes (sprint-4.md §0).
 */

import { midiNoteName } from '@/data/music';
import { eventKey, isMultiKey, keyColorSlots } from '@/lib/keyColor';
import { chordMidiNotes } from '@/lib/voicing';
import { secondsPerBeat } from '@/services/audio/schedule';
import type { ExportPlan, ExportSegment } from '@/services/videoExport/types';
import { colors, functionColor, keyTintSolids } from '@/theme/tokens';
import type { ChordEvent, MajorKey } from '@/types';

export type BuildExportPlanParams = {
  progression: ChordEvent[];
  key: MajorKey;
  bpm: number;
  title: string;
  durationSec: number;
  audioUri: string;
  watermark: boolean;
  /** Whole-arrangement register offset in octaves (mirrors playback/preview). */
  octaveShift?: number;
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
  octaveShift = 0,
): ExportSegment[] {
  if (progression.length === 0 || durationSec <= 0) return [];
  const spb = secondsPerBeat(bpm);
  const segments: ExportSegment[] = [];
  // Multi-key indicator: color each segment by its key-context slot (0 = base key
  // → neutral). Only emitted when the progression actually modulates.
  const multi = isMultiKey(progression, key);
  const slots = keyColorSlots(progression, key);
  const slotHex = (slot: number): string =>
    slot <= 0 ? colors.textFaint : keyTintSolids[(slot - 1) % keyTintSolids.length];
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
      keyTintHex: multi ? slotHex(slots.get(eventKey(ev, key)) ?? 0) : undefined,
      // Only spell the key next to the degree when the progression modulates.
      keyName: multi ? eventKey(ev, key) : undefined,
      midiNotes: chordMidiNotes(ev, key, octaveShift),
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
    octaveShift = 0,
    width = 1080,
    height = 1920,
    fps = 30,
    keyboardLow = 36,
    keyboardHigh = 60,
  } = params;

  const totalBeats = progression.reduce((sum, e) => sum + e.durationBeats, 0);
  const bars = Math.max(1, Math.ceil(totalBeats / 4));
  // Shift the visible keyboard window in lock-step with the notes so the drawn
  // range still frames the (now raised) voicing rather than empty low keys.
  const kbShift = 12 * octaveShift;

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
    chordsPerCycle: progression.length,
    watermark,
    keyboardLow: keyboardLow + kbShift,
    keyboardHigh: keyboardHigh + kbShift,
    pitchClassNames: pitchClassNamesFor(key),
    segments: buildSegments(progression, key, bpm, durationSec, octaveShift),
  };
}
