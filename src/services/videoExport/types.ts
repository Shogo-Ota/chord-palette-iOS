/**
 * Video-export domain types (Phase 4) — pure (no native imports) so the plan
 * builder, its tests, the service, and the native wrapper can share them.
 */

import type { CompareSceneManifestV1, VideoTemplateId } from '@/lib/videoExport/comparison';
import type { VideoVisualStyle } from './videoVisualStyle';

/** One read-only performance note used only by note-level video visuals. */
export type VisualNoteEvent = Readonly<{
  /** MIDI note number from the finalized performance. */
  pitch: number;
  /** Exact note-on time on the export timeline. */
  startSec: number;
  /** Exact sounding duration after Final MIDI's minimum-duration policy. */
  durationSec: number;
  /** Final MIDI velocity, 1..127. */
  velocity: number;
}>;

/** One chord occurrence on the export timeline (already laid out in seconds). */
export type ExportSegment = {
  /** Big chord name, e.g. "Cmaj7". */
  displayName: string;
  /** Degree label under the chord, e.g. "IM7" / "V7/II". */
  degreeLabel: string;
  /** Highlight / chord-name color (chord-function color), "#rrggbb". */
  colorHex: string;
  /**
   * Small key-context indicator color ("#rrggbb"), shown near the chord name only
   * when the progression spans multiple keys (modulation). Omitted for single-key
   * progressions so the visual stays clean.
   */
  keyTintHex?: string;
  /**
   * Key name for this chord's key context (e.g. "G"), rendered in parentheses after
   * the degree label — "Ⅴ (G)" — so a modulating video shows which key each degree
   * is read in. Omitted for single-key progressions (no ambiguity, keep it clean).
   */
  keyName?: string;
  /** MIDI notes highlighted on the keyboard. */
  midiNotes: number[];
  /** Segment start / length in seconds on the (looped) export timeline. */
  startSec: number;
  durationSec: number;
};

/** A fully-specified render plan handed to the native encoder in a single call. */
export type ExportPlan = {
  width: number; // 1080
  height: number; // 1920
  fps: number; // 30
  durationSec: number; // 15 | 30 | 60
  /** Offline-rendered audio (from AudioService.renderAudioFile). */
  audioUri: string;
  title: string;
  keyLabel: string;
  bpm: number;
  bars: number;
  /** Beats in one musical bar (4 for 4/4, 3 for waltz, 6 for 6/8). */
  beatsPerBar: number;
  /** Number of chords in one progression pass, so the encoder shows one dot per chord. */
  chordsPerCycle: number;
  watermark: boolean;
  /** Lowest / highest MIDI key drawn on the keyboard. */
  keyboardLow: number;
  keyboardHigh: number;
  /** Note name for each pitch class 0..11, spelled for the key (♭/♯). */
  pitchClassNames: string[];
  /** Segments laid end-to-end, looped to fill `durationSec`. */
  segments: ExportSegment[];
  /** Optional for backwards compatibility; plan builders always normalize it. */
  visualStyle?: VideoVisualStyle;
  /** Missing/unknown remains the existing Standard export. */
  templateId?: VideoTemplateId;
  /** Versioned read-only sidecar consumed only by the Compare renderer. */
  compareScene?: CompareSceneManifestV1;
  /**
   * Optional note-level visual sidecar. Classic and Pulse ignore it; Flow uses it
   * for falling blocks and keyboard landing without regenerating performance data.
   */
  visualNoteEvents?: readonly VisualNoteEvent[];
};

export type ExportVideoResult = {
  /** file:// URI of the temporary MP4. */
  uri: string;
};

/** Progress 0..1 while encoding (consumed by the export UI in 4B). */
export type ExportProgressEvent = {
  progress: number;
};
