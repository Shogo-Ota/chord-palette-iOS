/**
 * Video-export domain types (Phase 4) — pure (no native imports) so the plan
 * builder, its tests, the service, and the native wrapper can share them.
 */

/** One chord occurrence on the export timeline (already laid out in seconds). */
export type ExportSegment = {
  /** Big chord name, e.g. "Cmaj7". */
  displayName: string;
  /** Degree label under the chord, e.g. "IM7" / "V7/II". */
  degreeLabel: string;
  /** Highlight / chord-name color (chord-function color), "#rrggbb". */
  colorHex: string;
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
  watermark: boolean;
  /** Lowest / highest MIDI key drawn on the keyboard. */
  keyboardLow: number;
  keyboardHigh: number;
  /** Note name for each pitch class 0..11, spelled for the key (♭/♯). */
  pitchClassNames: string[];
  /** Segments laid end-to-end, looped to fill `durationSec`. */
  segments: ExportSegment[];
};

export type ExportVideoResult = {
  /** file:// URI of the temporary MP4. */
  uri: string;
};

/** Progress 0..1 while encoding (consumed by the export UI in 4B). */
export type ExportProgressEvent = {
  progress: number;
};
