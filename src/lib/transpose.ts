import { noteAt } from '@/data/music';
import type { ChordEvent, MajorKey } from '@/types';

/**
 * Recompute a single event's spelling for `key` from its stored degree data
 * (`rootOffset` / `suffix` / `bassOffset`). Degree labels are key-invariant for
 * every chord except slash/on-chords, whose bass note is respelled here.
 * Events that predate degree data (legacy JSON) are returned unchanged.
 */
export function transposeEvent(event: ChordEvent, key: MajorKey): ChordEvent {
  if (event.rootOffset == null) return event;

  const root = noteAt(key, event.rootOffset);
  let displayName = `${root}${event.suffix ?? ''}`;
  let degreeLabel = event.degreeLabel;
  let bassNote = event.bassNote;

  if (event.bassOffset != null) {
    const bass = noteAt(key, event.bassOffset);
    displayName = `${displayName}/${bass}`;
    bassNote = bass;
    degreeLabel = `${event.degreeLabel.split('/')[0]}/${bass}`;
  }

  return { ...event, displayName, degreeLabel, bassNote };
}

/** Transpose a whole progression to `key` (requirements §5.2). */
export function transposeProgression(progression: ChordEvent[], key: MajorKey): ChordEvent[] {
  return progression.map((e) => transposeEvent(e, key));
}
