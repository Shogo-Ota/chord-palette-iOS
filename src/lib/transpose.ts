import { keyTonicPc, noteAt } from '@/data/music';
import type { ChordEvent, MajorKey } from '@/types';

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

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

/** Transpose a whole progression to `key` (the "移調" action — moves the song). */
export function transposeProgression(progression: ChordEvent[], key: MajorKey): ChordEvent[] {
  return progression.map((e) => transposeEvent(e, key));
}

/**
 * Rebase an event's degree offsets so it keeps the SAME absolute pitch (and name)
 * when the reference key changes. `rootOffset` is stored relative to the tonic, so
 * changing the key alone would re-pitch the chord; here we shift the offsets by the
 * tonic delta to cancel that out. Display name / suffix / bass note are preserved.
 */
export function rebaseEvent(event: ChordEvent, fromKey: MajorKey, toKey: MajorKey): ChordEvent {
  if (event.rootOffset == null) return event;
  const shift = keyTonicPc(fromKey) - keyTonicPc(toKey);
  const rootOffset = mod12(event.rootOffset + shift);
  const bassOffset = event.bassOffset != null ? mod12(event.bassOffset + shift) : event.bassOffset;
  return { ...event, rootOffset, bassOffset };
}

/**
 * Change the reference key WITHOUT moving placed chords (the "キー変更" action):
 * every chord keeps its absolute pitch and displayed name.
 */
export function rebaseProgression(
  progression: ChordEvent[],
  fromKey: MajorKey,
  toKey: MajorKey,
): ChordEvent[] {
  return progression.map((e) => rebaseEvent(e, fromKey, toKey));
}
