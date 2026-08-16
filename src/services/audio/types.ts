/**
 * Audio domain types (Phase 2A) — canonical, pure (no native imports) so they
 * can be shared by the pure scheduling logic, its unit tests, the AudioService,
 * and the native module wrapper without pulling in `expo-modules-core`.
 */

import type { NativeMidiEvent } from '@/lib/playback';
import type { CountInConfig } from '@/lib/playback/countIn';

/* ------------------------------------------------------------------ */
/* Volume                                                              */
/* ------------------------------------------------------------------ */

export type VolumeChannel = 'master' | 'chord' | 'drum';
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
  'idle' | 'preparing' | 'ready' | 'playing' | 'paused' | 'stopped' | 'failed';

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
  /**
   * Beats in one bar for the drum wrap (`beat % beatsPerBar`). Defaults to 4 when
   * omitted so older callers and older binaries keep working.
   */
  beatsPerBar?: number;
  /**
   * Accompaniment rhythm id ('block' | 'eightBeat' | 'sixteenthBeat' | 'arpeggio' |
   * 'performance'). Native re-triggers/arpeggiates each chord's body notes on this
   * grid while the low bass sustains — except `'performance'`, which plays each
   * chord event 1:1 (Performance Engine output; no re-humanize).
   */
  accompaniment: string;
  /** Instrument id → native maps to a voice (SoundFont or dedicated EP synth). */
  instrument: string;
  /**
   * Optional seek into the loop on start (beats from head). Omit / 0 = from the
   * top. Used when live-reapplying timbre so the playhead does not rewind.
   */
  startBeat?: number;
  /**
   * Drum playback mode. `off` = silent, `clap` = backbeat claps, `full` = full kit.
   * Omitted / unknown → native treats as `full` (backward compatible).
   */
  drumMode?: 'off' | 'clap' | 'full';
  /**
   * Optional playback-only pre-roll. Native schedules it before beat zero; it is
   * never written into Final MIDI and never repeats with the song loop.
   */
  countIn?: CountInConfig;

  /* -- Playback v2 (realtime sampler). Omitted ⇒ the v1 pre-rendered path. ------ */

  /**
   * Which native engine plays this request. `sampled` (default) reads pre-rendered
   * buffers in a render callback; `sequencer` hands {@link smfBase64} to Apple's
   * sequencer driving a live `AVAudioUnitSampler`. Diagnostic-only switch — see
   * `src/services/audio/playbackEngine.ts`.
   */
  engine?: PlaybackEngineId;
  /** The whole plan as SMF Format 1 bytes, base64. Required by `sequencer`. */
  smfBase64?: string;
  /** Whether the SMF ends with a drum track (native must not guess the routing). */
  hasDrums?: boolean;
  /** GM program the melodic sampler loads (0 = grand piano, 4 = e.piano). */
  gmProgram?: number;
  /** Fingerprint of the Final MIDI, so an A/B can prove both engines got the same one. */
  planSignature?: string;
  /** Flattened MIDI schedule for the realtime sampler (v2). */
  midiEvents?: NativeMidiEvent[];
};

export type { NativeMidiEvent } from '@/lib/playback';

/** Native playback engine selector. */
export type PlaybackEngineId = 'sampled' | 'sequencer';

/** Single-chord audition (chord-card tap). */
export type PreviewRequest = {
  midiNotes: number[];
  velocity: number;
  lengthBeats?: number;
  bpm?: number;
  /** Instrument id → native maps to a voice (SoundFont or dedicated EP synth). */
  instrument: string;
};

/** Offline render request for video export (§sprint-4). Loops to fill `durationSec`. */
export type RenderAudioRequest = {
  bpm: number;
  totalBeats: number;
  chordEvents: NoteEvent[];
  drumPatternId: string;
  /** Accompaniment rhythm id — mirrors {@link PlaybackRequest.accompaniment}. */
  accompaniment: string;
  instrument: string;
  durationSec: number;
  /** Mirrors {@link PlaybackRequest.beatsPerBar}. */
  beatsPerBar?: number;
  drumMode?: 'off' | 'clap' | 'full';
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

  /* -- Sampled-buffer health (mid/high-register silence bug) ------------- */
  /**
   * Number of MIDI notes the sampled provider pre-rendered into PCM. With the
   * default lowNote=24…highNote=84 range a healthy load reports 61.
   */
  sampledNoteCount?: number;
  /**
   * MIDI note numbers whose pre-rendered buffer stayed (near-)silent after all
   * retries. **Empty ⇒ the register-silence bug is fixed.** A populated list
   * (e.g. `[48, 49, …]`) is the direct fingerprint of the regression.
   */
  sampledSilentNotes?: number[];
  /** Convenience length of {@link sampledSilentNotes} (0 ⇒ healthy). */
  sampledSilentNoteCount?: number;
  /**
   * Peak amplitude bucketed by MIDI octave (`"oct2"`…`"oct7"`). Every bucket
   * should carry a non-trivial peak; a ~0 bucket pinpoints a dead register.
   */
  sampledPeakByOctave?: Record<string, number>;

  /* -- Per-instrument SoundFont resolution (silent-fallback detection) ----- */
  /**
   * What each instrument id would actually load, keyed by id (`piano`, `ePiano`).
   * `found === false` on an entry with `isDedicatedBank === true` means that voice
   * silently falls back to another sound — the shape of "the timbre is wrong on
   * device but nothing errored".
   */
  instrumentSoundFonts?: Record<
    string,
    {
      soundFontName: string;
      found: boolean;
      program: number;
      isDedicatedBank: boolean;
      path?: string;
      sampledLoaded?: boolean;
      lastLoadError?: string;
    }
  >;

  /* -- Playback v2 ------------------------------------------------------- */
  /** Engine that played the most recent request (`sampled` | `sequencer`). */
  activeEngine?: string;
  /** State of the realtime sampler engine (v2), when the binary has it. */
  realtime?: {
    attached?: boolean;
    planLoaded?: boolean;
    isPlaying?: boolean;
    looping?: boolean;
    loopLengthBeats?: number;
    currentBeat?: number;
    drumBankLoaded?: boolean;
    instrument?: string;
    program?: number;
    soundFontPath?: string;
    planSignature?: string;
    lastError?: string;
    scheduledEventCount?: number;
    scheduler?: string;
    /** Melodic NoteOns actually handed to AVAudioUnitSampler (no 24–84 clamp). */
    sentNoteOnCount?: number;
    sentNoteOffCount?: number;
    sentCc64Count?: number;
    sentPitchMin?: number;
    sentPitchMax?: number;
  };
};

/* ------------------------------------------------------------------ */
/* Playback diagnostics (v1.01 Phase 1 — the "low notes only" report)  */
/* ------------------------------------------------------------------ */

/** One entry in the native playback lifecycle ring buffer. */
export type PlaybackDiagnosticsEvent = {
  /** ISO 8601 timestamp (fractional seconds). */
  at: string;
  /** Event kind: play / pause / stop / resume / interruption.* / routeChange / …. */
  kind: string;
  /** Free-form detail (e.g. `bpm=120 … noteRange=36-79 engineRunning=true`). */
  detail: string;
};

/**
 * Timeline + polyphony snapshot from the native engine. Read AFTER a playback
 * anomaly to reconstruct what led up to it:
 * - `planNoteMin/Max` low ceiling → the scheduled plan lacked high notes (JS side).
 * - Healthy plan range but low-only OUTPUT → native render/provider side.
 * - `cappedVoiceFrames > 0` → the polyphony cap engaged (overlap pile-up).
 */
export type PlaybackDiagnosticsSnapshot = {
  /** Recent lifecycle events, oldest first (ring buffer of 200). */
  events: PlaybackDiagnosticsEvent[];
  /** Total occurrences per event kind since engine creation. */
  counts: Record<string, number>;
  state: PlaybackState;
  isPlaying: boolean;
  engineRunning: boolean;
  prepared: boolean;
  /** Highest simultaneous chord voices seen in any render frame. */
  peakPolyphony: number;
  /** Voice ceiling enforced by the render callback. */
  polyphonyCap: number;
  /** Cumulative voice-frames skipped by the cap (0 ⇒ never engaged). */
  cappedVoiceFrames: number;
  currentFrame: number;
  planBpm?: number;
  planTotalBeats?: number;
  planAccompaniment?: string;
  planDrumPattern?: string;
  planStrikeCount?: number;
  /** Lowest scheduled MIDI note in the active plan. */
  planNoteMin?: number;
  /** Highest scheduled MIDI note in the active plan. */
  planNoteMax?: number;
};
