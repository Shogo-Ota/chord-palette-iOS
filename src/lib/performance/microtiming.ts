/**
 * Microtiming layer (design §4 "Microtiming"): timing offsets are NOT independent
 * per note. Each bar draws a single shared "feel" (the kick's push/pull) and every
 * track's offset is that feel plus a bounded, track-specific jitter — so Bass stays
 * within ±4ms of the kick, Hat sits −6..+4ms, Snare lays back +4..+14ms, and the
 * whole kit moves together.
 *
 * Bar-boundary drift = 0: the first step of every bar gets exactly 0 offset, and
 * offsets are computed from the absolute grid position (never chained off the
 * previous note), so error can never accumulate across bars or loops.
 */

import { streamFor } from './rng';
import { stepBeat, type MsRange, type StylePreset } from './styles/types';
import type { TrackId } from './NoteEvent';

const MS_PER_MINUTE = 60000;

/** Beat-fraction tolerance when detecting an off-beat 8th (guards float error). */
const OFFBEAT_EPS = 1e-6;

/** Convert a millisecond offset to a beat offset at the given tempo. */
export function msToBeat(ms: number, bpm: number): number {
  return (ms * bpm) / MS_PER_MINUTE;
}

/**
 * Tempo-adaptive scale for the microtiming window (design §4 "Micro Humanization —
 * テンポ適応"): faster songs need tighter timing, slower songs can breathe more.
 * Anchored at 110 bpm (=1.0) and clamped to [0.6, 1.15] so it never collapses to
 * zero nor balloons into sloppiness. Deterministic (pure function of tempo).
 */
export function tempoTimingScale(bpm: number): number {
  if (bpm <= 0) return 1;
  const raw = 110 / bpm;
  return Math.min(1.15, Math.max(0.6, raw));
}

/**
 * The microtiming jitter window for a track. The optional `top` voice has no spec of
 * its own (see {@link TrackId}) and inherits the `chord` window.
 */
function windowFor(style: StylePreset, track: TrackId): MsRange {
  return track === 'top' ? style.microtiming.chord : style.microtiming[track];
}

/**
 * The shared per-bar timing feel (ms) — drawn once per bar from a kick-scoped
 * stream. This is the single source every track correlates to; because it is the
 * same value for all tracks in a bar, their offsets are correlated (not independent).
 */
export function barKickFeelMs(seed: number, bar: number, style: StylePreset): number {
  const rng = streamFor(seed, 'kickFeel', bar);
  return rng.range(style.kickFeelMs.min, style.kickFeelMs.max);
}

/**
 * Timing offset (ms) for a single hit. Step 0 of a bar always returns 0 (drift
 * reset), unaffected by `scale`. Otherwise it is the shared bar feel plus a bounded
 * per-track jitter, the whole window multiplied by `scale` — the caller passes the
 * tempo-adaptive factor ({@link tempoTimingScale}) times the feel's `humanizeScale`,
 * so faster/tighter feels shrink the window and looser feels widen it. `scale = 1`
 * (the default) reproduces the pre-adaptation behaviour exactly.
 */
export function trackOffsetMs(
  seed: number,
  bar: number,
  step: number,
  track: TrackId,
  style: StylePreset,
  scale = 1,
): number {
  if (step === 0) return 0; // bar-boundary drift reset — see file header
  const feel = barKickFeelMs(seed, bar, style);
  const range = windowFor(style, track);
  const jitter = streamFor(seed, 'micro', track, bar, step).range(range.min, range.max);
  return (feel + jitter) * scale;
}

/**
 * Directed swing delay (in BEATS) for a hit — distinct from the humanize jitter above.
 * When the style swings (`style.swing`), an off-beat 8th (a step landing on the "&",
 * i.e. beat fraction ≈ 0.5) is pushed later so the beat's two 8ths form the ride's
 * long-short pattern; on-beats and 16th e/a positions are left straight so the off-beat
 * is the only moving part (Friberg & Sundström 2002; Nature Comms Physics 2022). This
 * is deterministic (pure function of the grid position) — no rng, so playback and the
 * offline export stay bit-identical.
 */
export function swingDelayBeats(style: StylePreset, step: number): number {
  const swing = style.swing;
  if (!swing) return 0;
  const beat = stepBeat(style, step);
  const frac = beat - Math.floor(beat); // position within the beat (0, .25, .5, .75)
  if (Math.abs(frac - 0.5) > OFFBEAT_EPS) return 0; // only the & swings
  return swing.offbeatRatio - 0.5; // e.g. triplet 0.667 − 0.5 = 0.167 beat later
}
