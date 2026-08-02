/**
 * Bass-line planner (implementation_v1.01 Phase 7).
 *
 * Runs AFTER the style skeleton collected the bass strikes and BEFORE Variation /
 * humanization, so the grid, velocity and timing pipelines are untouched — only
 * WHICH pitch each existing hit plays changes. Segments are runs of strikes that
 * voice the same root (an anticipated "食い" hit already carries the next chord's
 * root, so it opens the next segment and correctly stays on that root).
 *
 * Guarantees, per the spec:
 *  - a bar downbeat and a chord arrival always play the root (stable on strong),
 *  - out-of-chord tones (passing / chromatic approach) appear ONLY on the last
 *    hit before a root change, which is short by construction (its length runs
 *    just to the chord boundary),
 *  - consecutive pitches never leap more than an octave and stay in the bass
 *    register — a candidate that would is dropped back to the root,
 *  - all choices are seed-deterministic per segment, so no two chords are forced
 *    into one global movement and the same project always replays identically.
 */

import { streamFor } from '../rng';
import type { Strike } from '../strike';
import { bassProfileFor } from './profiles';

/** The chord shape the planner reads (structurally satisfied by `PerfChord`). */
export interface ChordTones {
  bodyMidi: number[];
  arpMidi?: number[];
}

export interface BassPlanInput {
  seed: number;
  /** Rhythm/style id of the take — selects the movement profile. */
  styleId: string;
  /** The chord a strike voices (anticipation included), for chord-true fifths. */
  chordOf: (strike: Strike) => ChordTones | undefined;
}

/** Bass register bounds (D1 – G3) and the largest allowed consecutive leap. */
const ABS_MIN = 26;
const ABS_MAX = 55;
const MAX_LEAP = 12;

const pc = (p: number): number => ((p % 12) + 12) % 12;

/**
 * The chord's own fifth above `root` — ♭5/♯5 chords (dim, aug, m7♭5…) keep their
 * altered fifth instead of a wrong perfect fifth. Falls back to +7 when the chord
 * spells no fifth at all.
 */
function fifthFor(root: number, chord: ChordTones | undefined): number {
  if (chord) {
    const classes = new Set([...(chord.arpMidi ?? []), ...chord.bodyMidi].map(pc));
    for (const interval of [7, 6, 8]) {
      if (classes.has(pc(root + interval))) return root + interval;
    }
  }
  return root + 7;
}

/**
 * The connective into the next root: a scale-wise passing tone when the roots sit
 * a third apart (and the coin says so), otherwise a chromatic approach from the
 * side the line travels from.
 */
function connectivePitch(root: number, nextRoot: number, passing: boolean): number {
  const diff = nextRoot - root;
  if (diff === 0) return root;
  const sign = diff > 0 ? 1 : -1;
  if (passing && (Math.abs(diff) === 3 || Math.abs(diff) === 4)) return root + sign * 2;
  return nextRoot - sign;
}

/** Fold into the register, then refuse any leap wider than an octave. */
function constrain(candidate: number, prev: number | undefined, fallback: number): number {
  let p = candidate;
  while (p < ABS_MIN) p += 12;
  while (p > ABS_MAX) p -= 12;
  if (prev !== undefined && Math.abs(p - prev) > MAX_LEAP) return fallback;
  return p;
}

/** Consecutive-run segmentation by the root each strike voices. */
function segmentByRoot(strikes: Strike[]): number[][] {
  const segments: number[][] = [];
  for (let i = 0; i < strikes.length; i++) {
    const root = strikes[i].pitches[0];
    const last = segments[segments.length - 1];
    if (last && strikes[last[0]].pitches[0] === root) last.push(i);
    else segments.push([i]);
  }
  return segments;
}

/** Plan the bass line. Root-only profiles return the input untouched (identity). */
export function planBassLine(strikes: Strike[], input: BassPlanInput): Strike[] {
  const profile = bassProfileFor(input.styleId);
  const isIdentity =
    profile.approachChance === 0 &&
    profile.figures.length === 1 &&
    profile.figures[0] === 'rootOnly';
  if (isIdentity || strikes.length === 0) return strikes;

  const segments = segmentByRoot(strikes);
  const out = strikes.map((s) => ({ ...s, pitches: [...s.pitches] }));
  let prev: number | undefined;

  segments.forEach((segment, segIndex) => {
    const root = strikes[segment[0]].pitches[0];
    const rng = streamFor(input.seed, 'bassLine', segIndex, root);
    const figure = rng.pick(profile.figures);
    const nextSegment = segments[segIndex + 1];
    const nextRoot = nextSegment ? strikes[nextSegment[0]].pitches[0] : undefined;
    const nextRootBeat = nextSegment ? strikes[nextSegment[0]].gridBeat : undefined;
    const approach =
      nextRoot !== undefined && nextRoot !== root && rng.bool(profile.approachChance);
    const passing = profile.passing && rng.bool();

    segment.forEach((idx, k) => {
      const strike = strikes[idx];
      const isChordArrival = k === 0;
      const isBarDownbeat = strike.step === 0;
      // A connective must be SHORT: it is only allowed when the next root sounds
      // within a beat, so a sparse pattern's last hit (2+ beats before the change)
      // stays a chord tone instead of hanging an out-of-chord note.
      const isLastBeforeChange =
        k === segment.length - 1 &&
        nextRoot !== undefined &&
        nextRootBeat !== undefined &&
        nextRootBeat - strike.gridBeat <= 1 + 1e-6;

      let pitch = root;
      if (isChordArrival || isBarDownbeat) {
        pitch = root; // stable tone on every strong landing
      } else if (isLastBeforeChange && approach) {
        pitch = connectivePitch(root, nextRoot!, passing);
      } else if (k % 2 === 1 && figure === 'rootFifth') {
        pitch = fifthFor(root, input.chordOf(strike));
      } else if (k % 2 === 1 && figure === 'rootOctave') {
        pitch = root + 12;
      }

      const constrained = constrain(pitch, prev, root);
      out[idx].pitches = [constrained];
      prev = constrained;
    });
  });

  return out;
}
