import { chordPitchClasses } from '@/data/chordPitchClassSet';
import { MINOR_SCALE_OFFSETS } from '@/data/minorMode';
import { MAJOR_SCALE_OFFSETS } from '@/data/music';
import type { ChordEvent, KeyMode } from '@/types';

/**
 * Whether a chord steps outside the key it is heard in.
 *
 * Decided from the notes, not from the category the chord was picked from. A
 * secondary dominant, a tritone substitute, a backdoor, a borrowed iv, a passing
 * diminished, a chromatic mediant and an augmented connector all qualify for the same
 * reason — at least one sounding pitch is not in the scale — so nothing has to be
 * enumerated, and a chord added later is covered the day it ships.
 *
 * Pitch classes are already tonic-relative, and `keyContext` travels with each event,
 * so a modulating progression is judged section by section: a chord that is diatonic
 * in the key it modulated to is not special there.
 */

function diatonicOffsets(mode: KeyMode): ReadonlySet<number> {
  return new Set(mode === 'minor' ? MINOR_SCALE_OFFSETS : MAJOR_SCALE_OFFSETS);
}

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

/**
 * The pitches this chord sounds that its key does not contain.
 *
 * The bass of a slash chord counts: `C/F#` is chromatic even though the upper
 * structure is plain I.
 */
export function outsideKeyPitchClasses(event: ChordEvent): number[] {
  const diatonic = diatonicOffsets(event.modeContext ?? 'major');
  const sounding = chordPitchClasses({
    rootOffset: event.rootOffset ?? 0,
    suffix: event.suffix ?? '',
    definitionId: event.definitionId,
  });
  if (event.bassOffset != null) sounding.push(wrap(event.bassOffset));
  return [...new Set(sounding)].filter((pitchClass) => !diatonic.has(pitchClass));
}

/** Whether the chord should read as a special moment in the video. */
export function isNonDiatonicChord(event: ChordEvent): boolean {
  return outsideKeyPitchClasses(event).length > 0;
}

/**
 * Positions within one progression pass whose chord leaves the key.
 *
 * Indexed by position rather than by time, because the export tiles the progression
 * end to end: the same position is the same chord on every loop, so one small array
 * covers a 15-second and a 60-second render alike, and the renderer never has to match
 * a floating-point start time.
 */
export function nonDiatonicCycleIndices(progression: readonly ChordEvent[]): number[] {
  return progression.reduce<number[]>((indices, event, index) => {
    if (isNonDiatonicChord(event)) indices.push(index);
    return indices;
  }, []);
}
