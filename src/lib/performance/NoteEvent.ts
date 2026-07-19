/**
 * NoteEvent — the domain output contract of the Performance Engine and the input
 * contract of any Renderer (sprint-6 §4.2 / design §1 "NoteEvent minimal contract").
 *
 * This is a pure, RN/Expo/native-independent type. It is intentionally a *different*
 * type from `@/services/audio/types` `NoteEvent` (the existing native playback shape):
 * this one is the higher-level *performance intent* (velocity curve, microtiming,
 * articulation, round-robin, seed already applied), which a Renderer maps down to the
 * native input in Step 3. Keeping them separate stops the domain from depending on the
 * audio/service layer.
 */

/** Playing technique carried per note; Renderers may interpret or ignore extras. */
export type Articulation = 'normal' | 'legato' | 'staccato' | 'tie' | 'pedal' | 'ghost';

/**
 * Which voice/instrument a note belongs to. Kept as a small closed union so the
 * engine and tests are type-safe, while remaining trivially extensible.
 */
export type TrackId = 'chord' | 'bass' | 'kick' | 'snare' | 'hat';

/**
 * The minimal performance contract. Every field is resolved by the engine — a
 * Renderer just plays it. `timeBeat`/`durationBeat` are on the common progression
 * timeline (beat 0 = head of the progression) with microtiming and gate already
 * folded in, so Renderers never re-humanize.
 */
export interface NoteEvent {
  /** Start position on the shared timeline, in beats (microtiming already applied). */
  timeBeat: number;
  /** Sounding length in beats (gate/articulation already applied). */
  durationBeat: number;
  /** MIDI note number. */
  pitch: number;
  /** MIDI velocity 1–127 (accent × phrase curve × per-note humanize already applied). */
  velocity: number;
  /** Playing technique. */
  articulation: Articulation;
  /** Round-robin sample index (same-sample-in-a-row avoided; reproducible by seed). */
  rrIndex: number;
  /** Which voice this note belongs to. */
  trackId: TrackId;
  /** The project seed that produced this event (same seed ⇒ same performance). */
  seed: number;
}

/** MIDI velocity is 1–127 (0 would be a note-off); clamp helper used across layers. */
export function clampVelocity(v: number): number {
  const r = Math.round(v);
  if (r < 1) return 1;
  if (r > 127) return 127;
  return r;
}
