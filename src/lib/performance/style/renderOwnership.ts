/**
 * Which chord's STYLE produced a note, and what may cross a STYLE boundary.
 *
 * Two distinct ownerships exist and must not be conflated:
 *
 * - *Render* ownership is the chord whose STYLE generated the note, i.e. the chord
 *   its onset falls in. This is what decides which render pass keeps the note.
 * - *Harmony* ownership is the chord whose pitches the note spells. For an
 *   intentional anticipation these differ: Dance pushes an attack 0.25 beats early,
 *   so the previous chord's rhythm sounds the next chord's voicing.
 *
 * Render ownership deliberately uses the exact chord window, with no Harmony Gate
 * anticipation tolerance. The gate's 1/8-beat look-ahead answers a different
 * question ("which harmony is this near-boundary note heard against?"). Reusing it
 * here would steal a late attack such as beat 2.98 from the chord that authored it
 * and assign it to a chord starting at beat 3.
 */

import { chordIndexForNote } from '../harmonyGate';
import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { FinalMidiControlChange } from '../finalMidi/types';

/** CC ownership exists only while STYLE passes are masked; Final MIDI strips it. */
export type OwnedControlChange = FinalMidiControlChange & {
  ownerChordIndex: number;
};

/** The chord whose STYLE generated this note (onset-bound). */
export function renderOwnerChordIndex(chords: readonly PerfChord[], note: NoteEvent): number {
  if (
    note.ownerChordIndex != null &&
    Number.isInteger(note.ownerChordIndex) &&
    note.ownerChordIndex >= 0 &&
    note.ownerChordIndex < chords.length
  ) {
    return note.ownerChordIndex;
  }
  if (chords.length === 0) return -1;
  let found = 0;
  for (let index = 0; index < chords.length; index += 1) {
    if (chords[index]!.startBeat <= note.timeBeat) found = index;
    else break;
  }
  return found;
}

/** The chord whose harmony this note spells (explicit anticipation target, else onset). */
export function harmonyOwnerChordIndex(chords: readonly PerfChord[], note: NoteEvent): number {
  return chordIndexForNote(chords, note);
}

/**
 * Whether a note spans two chords played in different STYLEs.
 *
 * Contract: an attack whose onset chord and target chord do not share a STYLE is
 * discarded. Only an intentional anticipation can be in this position, and letting
 * it through would make one STYLE's rhythm voice another STYLE's chord — a figure
 * neither STYLE would ever play. Ordinary notes have one owner, so this is false
 * for them and the whole rule is inert in a single-STYLE progression.
 */
export function crossesStyleBoundary(
  chords: readonly PerfChord[],
  note: NoteEvent,
  styleKeyOf: (chordIndex: number) => string | undefined,
): boolean {
  const render = renderOwnerChordIndex(chords, note);
  const harmony = harmonyOwnerChordIndex(chords, note);
  if (render === harmony) return false;
  return styleKeyOf(render) !== styleKeyOf(harmony);
}
