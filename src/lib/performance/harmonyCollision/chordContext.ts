/**
 * Chord context — what a pair rule is allowed to know about the sounding chord.
 *
 * The allowed pitch classes come from {@link allowedPcsFor}, the same set the
 * harmony gate judges membership with, so the two layers can never disagree about
 * what belongs to a chord. Only tones the symbol actually spells are admitted: an
 * `Fmaj7` offers F A C E and nothing else, and the accompaniment layer has no
 * licence to invent a G.
 *
 * Tension pitch classes and the ♭9 are read off the chord's own interval spelling
 * using the interval vocabulary the voicing policies share, so `C7(♭9)` and any
 * future chord presenting a 13 reach the same conclusion.
 */

import { allowedPcsFor } from '../harmonyGate';
import { intervalRole, isTensionRole } from '../baseVoicing/policy/intervalRoles';
import type { PerfChord } from '../PerformanceEngine';
import type { HarmonyCollisionChord } from './types';

/** Compound spellings a symbol uses for a ninth: ♭9, 9 and ♯9. */
const NINTH_INTERVALS: ReadonlySet<number> = new Set([1, 2, 13, 14, 15]);
const FLAT_NINTH_INTERVALS: ReadonlySet<number> = new Set([1, 13]);

function wrap(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12;
}

export function harmonyCollisionChordFor(chord: PerfChord): HarmonyCollisionChord {
  return {
    ...collisionChordFromIntervals(
      chord.harmony ? wrap(chord.harmony.rootPc) : 0,
      chord.harmony?.chordIntervals ?? [],
    ),
    symbol: chord.harmony?.symbol ?? '(untitled)',
    allowedPitchClasses: allowedPcsFor(chord),
    startBeat: chord.startBeat,
  };
}

/**
 * The same context derived from a root and an interval spelling alone, for callers
 * that hold a harmony rather than a placed chord — a voicing policy judging a
 * candidate before it has a position on the timeline.
 */
export function collisionChordFromIntervals(
  rootPc: number,
  intervals: readonly number[],
): HarmonyCollisionChord {
  const root = wrap(rootPc);
  const allowedPitchClasses: number[] = [];
  const tensionPcs: number[] = [];
  const flatNinthPcs: number[] = [];
  let carriesNinth = false;
  for (const interval of intervals) {
    const pc = wrap(root + interval);
    if (!allowedPitchClasses.includes(pc)) allowedPitchClasses.push(pc);
    if (isTensionRole(intervalRole(interval)) && !tensionPcs.includes(pc)) tensionPcs.push(pc);
    if (NINTH_INTERVALS.has(interval)) carriesNinth = true;
    if (FLAT_NINTH_INTERVALS.has(interval) && !flatNinthPcs.includes(pc)) flatNinthPcs.push(pc);
  }
  return {
    symbol: '(harmony)',
    rootPc: root,
    allowedPitchClasses: allowedPitchClasses.sort((left, right) => left - right),
    tensionPcs,
    flatNinthPcs,
    carriesNinth,
    startBeat: 0,
  };
}
