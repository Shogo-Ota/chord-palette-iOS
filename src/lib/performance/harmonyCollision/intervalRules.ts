/**
 * Pair rules — the verdict for two notes that sound at the same time.
 *
 * Every rule reads the sounding distance `upper - lower` in semitones, never an
 * interval class. That distinction is the whole point: a major seventh is consonant
 * (`C4 + B4`) while its inversion a semitone apart is not (`B3 + C4`), and a minor
 * ninth (`C3 + Db4`) is mud where the same two pitch classes an octave closer are
 * a plain minor second reject. Collapsing either pair to "interval class 1" would
 * reach the wrong answer.
 *
 * Rules are applied in the order the contract fixes, and the first reject wins so a
 * pair always reports a single, reproducible cause.
 */

import { lowIntervalLimitVerdict } from './lowIntervalLimit';
import type {
  HarmonyCollisionChord,
  HarmonyCollisionMode,
  HarmonyCollisionResult,
  HarmonyCollisionRuleId,
  InstrumentCollisionProfile,
} from './types';

export type IntervalVerdict = {
  readonly ruleId: HarmonyCollisionRuleId;
  readonly result: HarmonyCollisionResult;
  readonly reason: string;
};

function wrap(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12;
}

/**
 * A minor ninth is admissible only where the symbol itself asked for it: the upper
 * note has to be a ♭9 the chord names, sitting a semitone above the note below it.
 * `G7(♭9)` earns `G3 + Ab4`; a plain `C` never earns `C3 + Db4`.
 */
function isDeclaredFlatNinth(
  lowerNote: number,
  upperNote: number,
  chord: HarmonyCollisionChord,
): boolean {
  if (chord.flatNinthPcs.length === 0) return false;
  if (!chord.flatNinthPcs.includes(wrap(upperNote))) return false;
  return wrap(upperNote - lowerNote) === 1;
}

/**
 * The verdict for one overlapping pair, or `null` when the distance carries no named
 * rule (a third, a fourth, a fifth and a sixth are simply consonant).
 *
 * `lowerNote` must be the lower of the two MIDI numbers.
 */
export function evaluateIntervalPair(
  lowerNote: number,
  upperNote: number,
  chord: HarmonyCollisionChord,
  profile: InstrumentCollisionProfile,
  mode: HarmonyCollisionMode = 'normal',
): IntervalVerdict | null {
  const distance = upperNote - lowerNote;

  if (distance === 0) {
    return {
      ruleId: 'DUPLICATE_NOTE',
      result: 'MERGE',
      reason: 'Identical MIDI note sounding twice — merge to one note.',
    };
  }

  const lowRegister = lowIntervalLimitVerdict(lowerNote, distance, profile);
  if (lowRegister) return lowRegister;

  if (distance === 1) {
    if (mode === 'cluster') {
      return {
        ruleId: 'MINOR_SECOND',
        result: 'ALLOW',
        reason: 'Cluster mode admits a close minor second.',
      };
    }
    return {
      ruleId: 'MINOR_SECOND',
      result: 'REJECT',
      reason: 'Close minor second — barred from ordinary accompaniment voicing.',
    };
  }

  if (distance === 13) {
    if (isDeclaredFlatNinth(lowerNote, upperNote, chord)) {
      return {
        ruleId: 'MINOR_NINTH',
        result: 'ALLOW',
        reason: 'Minor ninth is the ♭9 the chord symbol names.',
      };
    }
    return {
      ruleId: 'MINOR_NINTH',
      result: 'REJECT',
      reason: 'Minor ninth the chord symbol never asked for.',
    };
  }

  if (distance === 2) {
    if (mode === 'cluster' || lowerNote >= profile.majorSecondFloor) {
      return {
        ruleId: 'MAJOR_SECOND',
        result: 'ALLOW',
        reason: 'Major second in the upper register.',
      };
    }
    if (chord.carriesNinth) {
      return {
        ruleId: 'MAJOR_SECOND',
        result: 'ALLOW',
        reason: 'Major second below the floor, but the chord symbol names a 9th.',
      };
    }
    return {
      ruleId: 'MAJOR_SECOND',
      result: 'REJECT',
      reason: 'Major second below the register floor with no 9th in the symbol.',
    };
  }

  // Chord membership already guarantees both notes belong to the chord, so a
  // tritone here is always one the chord definition needs — dominant, m7♭5, dim,
  // dim7, ♯11, ♭5 or altered. It is classified, never rejected.
  if (distance === 6) {
    return { ruleId: 'TRITONE', result: 'ALLOW', reason: 'Tritone between two chord tones.' };
  }

  if (distance === 11) {
    return { ruleId: 'MAJOR_SEVENTH', result: 'ALLOW', reason: 'Major seventh spread apart.' };
  }

  if (distance === 12) {
    return { ruleId: 'OCTAVE', result: 'ALLOW', reason: 'Octave.' };
  }

  return null;
}
