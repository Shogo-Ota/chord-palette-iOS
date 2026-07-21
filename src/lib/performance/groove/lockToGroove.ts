/**
 * Groove-lock refinement (design §4 role separation / microtiming): nudge a resolved
 * comp template so the piano/bass agree with the drum groove that is actually playing,
 * WITHOUT changing the template's rhythm (no hits added or removed) so the chosen Feel
 * keeps its identity. The values here are grounded in the performance-timing literature
 * rather than picked by ear:
 *
 *  1. Chord accents on the groove's backbeat get a small bonus → the comp agrees with
 *     the snare (the backbeat is conventionally the emphasised beat in pop/rock/soul).
 *  2. Bass accents on the groove's kick beats get a small bonus → the low end locks to
 *     the kick.
 *  3. Swing grooves (jazz) get a tempo-dependent swing ratio so the comp's off-beat
 *     8ths ride the same long-short pattern as the cymbal. Swing ratio is NOT a fixed
 *     triplet: it falls from ~3.5:1 at slow tempi to ~1:1 at fast tempi (Friberg &
 *     Sundström, "Swing Ratios and Ensemble Timing in Jazz Performance", Music
 *     Perception 2002). We convert that ratio to an off-beat position fraction and
 *     clamp it near the (fixed) triplet ride so the comp stays LOCKED to the ride
 *     across this app's tempo range — the whole point of the lock.
 *
 * Pure function of `(template, profile, tempoBpm)` — same inputs ⇒ identical output. No
 * RN / Expo / native imports. The strength constants live here so tuning is editing
 * values, not logic.
 */

import { backbeatBeats, type DrumProfile } from './drumProfiles';
import { stepBeat, type StepPattern, type StylePreset, type SwingSpec } from '../styles/types';

/** Beat-match tolerance (grid beats are exact rationals; guards float error only). */
const BEAT_EPS = 1e-6;

/** Subtle accent bonus where the chord lands on the groove's backbeat (2 & 4). */
const BACKBEAT_ACCENT_BONUS = 0.06;
/** Subtle accent bonus where the bass lands on a groove kick. */
const KICK_LOCK_ACCENT_BONUS = 0.05;

/**
 * Swing ratio (long:short) as a function of tempo, per Friberg & Sundström (2002):
 * roughly linear, ~3.0 at slow tempi easing to ~1.0 (straight) at fast tempi. Their
 * data spans ~3.5:1 → 1:1; we anchor the useful song range: 80 bpm ⇒ 3.0, 180 bpm ⇒
 * 1.0, clamped so it never inverts.
 */
const SWING_RATIO_AT_SLOW = 3.0; // ~80 bpm
const SWING_SLOPE_PER_BPM = 0.02; // ratio lost per bpm above 80
const SWING_REF_BPM = 80;
/**
 * Keep the resolved off-beat fraction locked near the ride cymbal, which the native
 * drum synth plays at a fixed 2/3 (triplet). Clamp to [0.58, 0.667]: a lighter swing
 * at fast tempi, never more than the triplet ride (so the comp can't drift past it).
 */
const SWING_FRACTION_MIN = 0.58;
const SWING_FRACTION_MAX = 2 / 3;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Off-beat 8th position (fraction of the beat) the comp should swing to at `bpm`. */
export function swingFractionForTempo(bpm: number): number {
  const ratio = clamp(SWING_RATIO_AT_SLOW - (bpm - SWING_REF_BPM) * SWING_SLOPE_PER_BPM, 1, 3);
  const fraction = ratio / (ratio + 1); // long:short ratio → off-beat position
  return clamp(fraction, SWING_FRACTION_MIN, SWING_FRACTION_MAX);
}

/** Does `beat` (0..beatsPerBar) coincide with any of the anchor `targets`? */
function beatMatches(beat: number, targets: readonly number[]): boolean {
  return targets.some((t) => Math.abs(beat - t) < BEAT_EPS);
}

/**
 * Return a copy of `pattern` with `bonus` added (capped at 1) to the accent of every
 * HIT step whose beat coincides with one of the anchor beats. Non-hit steps and steps
 * off the anchors are untouched, and `hits`/`ghost` are preserved (rhythm unchanged).
 */
function bumpAccentsAtAnchors(
  pattern: StepPattern,
  style: StylePreset,
  anchors: readonly number[],
  bonus: number,
): StepPattern {
  const accent = pattern.accent.slice();
  for (let step = 0; step < style.stepsPerBar; step++) {
    if (!pattern.hits[step]) continue;
    if (beatMatches(stepBeat(style, step), anchors)) {
      accent[step] = Math.min(1, (accent[step] ?? 0.6) + bonus);
    }
  }
  return { ...pattern, accent };
}

/**
 * Lock a resolved comp template to a drum groove at `tempoBpm`. Only accent weights and
 * (for swing grooves) the swing spec change; hit positions, gate, velocity centers and
 * every other track stay exactly as the Feel resolved them.
 */
export function lockToGroove(template: StylePreset, profile: DrumProfile, tempoBpm: number): StylePreset {
  const chord = bumpAccentsAtAnchors(template.chord, template, backbeatBeats(profile), BACKBEAT_ACCENT_BONUS);
  const bass = bumpAccentsAtAnchors(template.bass, template, profile.kickBeats, KICK_LOCK_ACCENT_BONUS);
  const locked: StylePreset = { ...template, chord, bass };
  if (profile.swing) {
    const swing: SwingSpec = { offbeatRatio: swingFractionForTempo(tempoBpm) };
    locked.swing = swing;
  }
  return locked;
}
