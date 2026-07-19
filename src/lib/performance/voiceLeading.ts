/**
 * Voice leading (pure, UI/RN/Expo-independent). Given the root-position chord
 * bodies of a progression, re-voices each chord so consecutive chords keep common
 * tones and move by the smallest possible distance instead of every chord jumping
 * back to root position. Implements requirements §5.5 ("basic voice leading is
 * applied automatically") and the music-supervisor audit P0-1 / the Performance
 * Engine design §4 ("common tones held, inner voices within ±7 semitones").
 *
 * This is layer 2 (Voicing) of the Performance Engine (sprint-6 §4.1). It is a
 * progression-level concern — it needs the *previous* chord — so it lives here
 * rather than in the single-chord `chordMidiNotes()` (which stays context-free for
 * previews and the keyboard visual). `voicing.ts` calls into this module.
 *
 * Determinism: no `Math.random`. Candidate voicings are enumerated and scored by a
 * fixed cost function with deterministic tie-breaking, so the same input always
 * yields the same output (design §4.3 "seed-derived only, never bare Math.random").
 */

/** Tuning knobs for the voice-leading search. All have musical defaults. */
export interface VoiceLeadingOptions {
  /**
   * Register the chord body is nudged toward (MIDI). Defaults to the mean of the
   * first chord's voicing, which anchors the whole progression and prevents slow
   * register drift while still allowing smooth motion.
   */
  targetCenterMidi?: number;
  /** Lowest MIDI note the body may occupy (C3 band floor). */
  floorMidi: number;
  /** Highest MIDI note the body may occupy (register-drift ceiling). */
  ceilMidi: number;
  /** Soft limit on how far any single voice moves between chords (semitones). */
  maxVoiceStep: number;
  /** Weight of register deviation in the cost (keeps voicings centered). */
  registerWeight: number;
  /** Weight of top-note (melody) movement — biases toward a smooth top line. */
  topWeight: number;
  /** Penalty added per voice that exceeds {@link maxVoiceStep}. */
  stepPenalty: number;
}

/**
 * Defaults chosen for the app's mid-register piano band (C3≈48..C5≈72). Movement
 * dominates the cost; register/top weights only break ties musically.
 */
export const DEFAULT_VOICE_LEADING_OPTIONS: VoiceLeadingOptions = {
  floorMidi: 45,
  ceilMidi: 72,
  maxVoiceStep: 7,
  registerWeight: 0.25,
  topWeight: 0.3,
  stepPenalty: 100,
};

/** Floating-point comparison tolerance for deterministic tie-breaking. */
const EPSILON = 1e-9;

function ascending(notes: number[]): number[] {
  return [...notes].sort((a, b) => a - b);
}

function mean(notes: number[]): number {
  if (notes.length === 0) return 0;
  return notes.reduce((sum, n) => sum + n, 0) / notes.length;
}

function topNote(notes: number[]): number {
  return notes.length === 0 ? 0 : Math.max(...notes);
}

/** Distance from `note` to the nearest note in `reference` (∞ if reference empty). */
function nearestDistance(note: number, reference: number[]): number {
  if (reference.length === 0) return Number.POSITIVE_INFINITY;
  return reference.reduce((best, r) => Math.min(best, Math.abs(note - r)), Number.POSITIVE_INFINITY);
}

/**
 * Mean voice movement from `prev` → `next`, measured as the average distance each
 * note of `next` travels from the nearest sounding note of `prev`. Common tones
 * contribute 0, so holding notes is rewarded. Well-defined even when the chords
 * have different note counts (triad → seventh).
 */
export function averageVoiceMovement(prev: number[], next: number[]): number {
  if (next.length === 0 || prev.length === 0) return 0;
  const total = next.reduce((sum, n) => sum + nearestDistance(n, prev), 0);
  return total / next.length;
}

/** Largest single-voice movement from `prev` → `next` (nearest-note metric). */
export function maxVoiceMovement(prev: number[], next: number[]): number {
  if (next.length === 0 || prev.length === 0) return 0;
  return next.reduce((worst, n) => Math.max(worst, nearestDistance(n, prev)), 0);
}

/** Exact MIDI notes present in both voicings (common tones held at the same pitch). */
export function commonTones(a: number[], b: number[]): number[] {
  const set = new Set(b);
  return ascending(a.filter((n) => set.has(n)));
}

/**
 * Mean voice movement across an entire (already voice-led) progression: the average
 * of {@link averageVoiceMovement} over every adjacent chord pair. This is the metric
 * the acceptance criterion "average voice movement ≤ 4 semitones" is measured with.
 */
export function progressionAverageMovement(voicings: number[][]): number {
  if (voicings.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < voicings.length; i++) {
    total += averageVoiceMovement(voicings[i - 1], voicings[i]);
  }
  return total / (voicings.length - 1);
}

/**
 * Shift a whole voicing up/down by octaves so it sits within [floor, ceil] as much
 * as possible (the pitch-class set and internal intervals are preserved). If the
 * voicing spans wider than the range it is left as-centered as octave shifts allow.
 */
function clampVoicingIntoRange(notes: number[], floor: number, ceil: number): number[] {
  let voicing = ascending(notes);
  // Guard against pathological inputs; octave shifts can never fix a span > range.
  let guard = 0;
  while (Math.min(...voicing) < floor && Math.max(...voicing) + 12 <= ceil && guard++ < 12) {
    voicing = voicing.map((n) => n + 12);
  }
  guard = 0;
  while (Math.max(...voicing) > ceil && Math.min(...voicing) - 12 >= floor && guard++ < 12) {
    voicing = voicing.map((n) => n - 12);
  }
  return voicing;
}

/**
 * The inversions of a chord body: rotate the lowest note up an octave, keeping the
 * pitch-class set intact. For a k-note chord this yields k rotations.
 */
function inversions(body: number[]): number[][] {
  const result: number[][] = [];
  let current = ascending(body);
  for (let i = 0; i < body.length; i++) {
    result.push([...current]);
    const [lowest, ...rest] = current;
    current = ascending([...rest, lowest + 12]);
  }
  return result;
}

/** Stable string key for de-duplicating identical candidate voicings. */
function voicingKey(notes: number[]): string {
  return ascending(notes).join(',');
}

/**
 * All candidate voicings for `body`: every inversion at every octave offset within
 * a ±2-octave window, each clamped into [floor, ceil] and de-duplicated. Guaranteed
 * to contain at least one in-range candidate.
 */
function candidateVoicings(body: number[], floor: number, ceil: number): number[][] {
  const seen = new Set<string>();
  const candidates: number[][] = [];
  for (const inv of inversions(body)) {
    for (let octave = -24; octave <= 24; octave += 12) {
      const clamped = clampVoicingIntoRange(
        inv.map((n) => n + octave),
        floor,
        ceil,
      );
      const key = voicingKey(clamped);
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(clamped);
      }
    }
  }
  return candidates;
}

/** Weighted cost of playing `candidate` after `previous` (lower = smoother). */
function voicingCost(
  previous: number[],
  candidate: number[],
  targetCenter: number,
  options: VoiceLeadingOptions,
): number {
  const movement = averageVoiceMovement(previous, candidate);
  const registerDeviation = Math.abs(mean(candidate) - targetCenter);
  const topMovement = Math.abs(topNote(candidate) - topNote(previous));
  const violations = candidate.reduce(
    (count, n) => count + (nearestDistance(n, previous) > options.maxVoiceStep ? 1 : 0),
    0,
  );
  return (
    movement +
    options.registerWeight * registerDeviation +
    options.topWeight * topMovement +
    options.stepPenalty * violations
  );
}

/**
 * Choose the smoothest voicing of `body` to follow `previous`. Enumerates all
 * inversion × octave candidates and picks the minimum-cost one, breaking ties
 * deterministically (lower register deviation, then lowest sorted notes) so the
 * result is fully reproducible.
 */
export function voiceLeadNext(
  previous: number[],
  body: number[],
  options: VoiceLeadingOptions = DEFAULT_VOICE_LEADING_OPTIONS,
  targetCenterMidi?: number,
): number[] {
  if (body.length === 0) return [];
  if (previous.length === 0) return clampVoicingIntoRange(body, options.floorMidi, options.ceilMidi);

  const targetCenter = targetCenterMidi ?? mean(previous);
  const candidates = candidateVoicings(body, options.floorMidi, options.ceilMidi);

  let best = candidates[0];
  let bestCost = voicingCost(previous, best, targetCenter, options);
  let bestReg = Math.abs(mean(best) - targetCenter);
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    const cost = voicingCost(previous, candidate, targetCenter, options);
    if (cost < bestCost - EPSILON) {
      best = candidate;
      bestCost = cost;
      bestReg = Math.abs(mean(candidate) - targetCenter);
      continue;
    }
    if (Math.abs(cost - bestCost) <= EPSILON) {
      const reg = Math.abs(mean(candidate) - targetCenter);
      // Deterministic tie-break: closer to register, then lexicographically lower.
      if (
        reg < bestReg - EPSILON ||
        (Math.abs(reg - bestReg) <= EPSILON && voicingKey(candidate) < voicingKey(best))
      ) {
        best = candidate;
        bestCost = cost;
        bestReg = reg;
      }
    }
  }
  return best;
}

/**
 * Re-voice a whole progression of root-position chord bodies for smooth voice
 * leading. The first chord is kept in its supplied (root) position — only clamped
 * into range — so it anchors the register; every later chord is voiced to follow
 * its predecessor. The target register is fixed to the first chord's mean to stop
 * cumulative drift. Pure and deterministic.
 */
export function voiceLeadProgression(
  bodies: number[][],
  options: VoiceLeadingOptions = DEFAULT_VOICE_LEADING_OPTIONS,
): number[][] {
  if (bodies.length === 0) return [];

  const first = clampVoicingIntoRange(bodies[0], options.floorMidi, options.ceilMidi);
  const result: number[][] = [first];
  const targetCenter = options.targetCenterMidi ?? mean(first);

  for (let i = 1; i < bodies.length; i++) {
    result.push(voiceLeadNext(result[i - 1], bodies[i], options, targetCenter));
  }
  return result;
}
