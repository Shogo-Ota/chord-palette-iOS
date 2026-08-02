/**
 * Chord → MIDI voicing (pure, UI-independent). Turns the degree-based chord data
 * carried on every {@link ChordEvent} (`rootOffset` semitones above the tonic +
 * quality `suffix`, plus an optional slash `bassOffset`) into concrete MIDI note
 * numbers for the audio engine. Intervals come from {@link CHORD_CATALOG}.
 */

import { keyTonicPc } from '@/data/music';
import { chordMidiNotesFromParts } from '@/lib/music/midi';
import type { ChordSpec } from '@/services/audio/schedule';
import type { ChordEvent, MajorKey } from '@/types';

/**
 * Concrete MIDI notes for a chord in the given key. Every chord is anchored by a
 * two-octave bass fundamental (C1 + C2) — the chord root, or the slash bass when
 * present — so the low end carries weight. The chord body sits in the C3 band.
 */
export function chordMidiNotes(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset' | 'definitionId'>,
  key: MajorKey,
): number[] {
  return chordMidiNotesFromParts(
    {
      rootOffset: chord.rootOffset ?? 0,
      suffix: chord.suffix ?? '',
      definitionId: chord.definitionId,
      bassOffset: chord.bassOffset,
    },
    keyTonicPc(key),
  );
}

/** Map a progression to the ChordSpec list consumed by the scheduler. */
export function progressionToChordSpecs(progression: ChordEvent[], key: MajorKey): ChordSpec[] {
  return progression.map((e) => ({
    midiNotes: chordMidiNotes(e, key),
    lengthBeats: e.durationBeats,
  }));
}
