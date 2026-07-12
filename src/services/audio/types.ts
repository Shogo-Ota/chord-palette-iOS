/**
 * Audio domain types (Phase 2A) — canonical, pure (no native imports) so they
 * can be shared by the pure scheduling logic, its unit tests, the AudioService,
 * and the native module wrapper without pulling in `expo-modules-core`.
 */

/* ------------------------------------------------------------------ */
/* Volume                                                              */
/* ------------------------------------------------------------------ */

export type VolumeChannel = 'master' | 'chord' | 'drum';

/** Linear volumes, 0.0–1.0. Canonical persistence lives in SQLite (§5.1). */
export type VolumeLevels = {
  master: number;
  chord: number;
  drum: number;
};

export const VOLUME_MIN = 0.0;
export const VOLUME_MAX = 1.0;

export const VOLUME_DEFAULTS: VolumeLevels = {
  master: 0.9,
  chord: 0.85,
  drum: 0.8,
};

/* ------------------------------------------------------------------ */
/* Playback state machine (§3.1)                                       */
/* ------------------------------------------------------------------ */

export type PlaybackState =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'failed';

/* ------------------------------------------------------------------ */
/* Playback request (generic — no hard-coded progression)              */
/* ------------------------------------------------------------------ */

/** One (poly)chord occurrence on the timeline, addressed by absolute start beat. */
export type NoteEvent = {
  /** Simultaneous MIDI note numbers (e.g. Cmaj7 = [60, 64, 67, 71]). */
  midiNotes: number[];
  /** Absolute start beat from the head of the progression. */
  startBeat: number;
  /** Length in beats. */
  lengthBeats: number;
  /** MIDI velocity 0–127. */
  velocity: number;
};

/** A fully-specified request handed to the native engine in a single call. */
export type PlaybackRequest = {
  bpm: number;
  /** Total beats of the progression — the loop boundary. */
  totalBeats: number;
  loop: boolean;
  chordEvents: NoteEvent[];
  /** Native holds the concrete drum-pattern definition for this id. */
  drumPatternId: string;
  /** Instrument id → native maps to a General MIDI program (SoundFont). */
  instrument: string;
};

/** Single-chord audition (chord-card tap). */
export type PreviewRequest = {
  midiNotes: number[];
  velocity: number;
  lengthBeats?: number;
  bpm?: number;
  /** Instrument id → native maps to a General MIDI program (SoundFont). */
  instrument: string;
};

/** Offline render request for video export (§sprint-4). Loops to fill `durationSec`. */
export type RenderAudioRequest = {
  bpm: number;
  totalBeats: number;
  chordEvents: NoteEvent[];
  drumPatternId: string;
  instrument: string;
  durationSec: number;
};

/** Result of an offline audio render: a temp file URI + its sample rate. */
export type RenderAudioResult = {
  uri: string;
  sampleRate: number;
};

/** UI-only position update. NEVER used to drive the audio clock (§4.2). */
export type PositionEvent = {
  chordIndex: number;
  beat: number;
  loopCount: number;
};

export type StateChangeEvent = {
  state: PlaybackState;
};

/* ------------------------------------------------------------------ */
/* Diagnostics (SoundFont resolution — for the synth-fallback bug)     */
/* ------------------------------------------------------------------ */

/**
 * Snapshot of how the native engine resolved (or failed to resolve/load) the
 * bundled General MIDI SoundFont. Surfaced so the root cause of "synth fallback
 * instead of the sampled grand piano" is visible from Metro logs — a Windows dev
 * cannot read native `os_log`.
 *
 * Decisive signals:
 * - `soundFontFound === false` → the .SF2 is not in the shipped bundle.
 * - `soundFontBytes ≈ 134`     → a Git-LFS pointer was bundled, not the real file.
 * - `soundFontBytes ≈ 148 MB`  → the real file shipped.
 * - `sampledLoaded === false` with a `lastLoadError` → `loadSoundBankInstrument` failed.
 */
export type AudioDiagnostics = {
  /** True when `soundFontURL()` resolved a non-nil URL. */
  soundFontFound: boolean;
  /** Absolute path of the resolved SoundFont, when found. */
  soundFontPath?: string;
  /** Real byte size of the resolved file (134 ≈ LFS pointer, ~148 MB ≈ real). */
  soundFontBytes?: number;
  /** True when the active chord voice is the sampled (SoundFont) provider. */
  sampledLoaded: boolean;
  /** Instrument id currently loaded into the engine. */
  currentInstrument?: string;
  /** Whether the engine has completed `prepare()`. */
  prepared?: boolean;
  /** Last `loadSoundBankInstrument` error string, when the sampled load failed. */
  lastLoadError?: string;
  /** Bundle paths the engine searched for the SoundFont (debugging aid). */
  searchedBundlePaths?: string[];
  /** Resource roots recursively scanned as a fallback (debugging aid). */
  searchedResourceRoots?: string[];
};
