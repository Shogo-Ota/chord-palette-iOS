import { degreeLabelFromOffset, keyTonicPc, noteAt, rootDegreeLabel } from '@/data/music';
import type { ChordEvent, MajorKey } from '@/types';

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Numerator (the chord's own degree) of a slash degree label — everything before
 * the LAST '/'. Preserves compound numerators like "V7/ii"; falls back to the whole
 * label when there is no slash. */
function degreeNumerator(degreeLabel: string): string {
  const i = degreeLabel.lastIndexOf('/');
  return i >= 0 ? degreeLabel.slice(0, i) : degreeLabel;
}

/**
 * Recompute a single event's spelling for `key` from its stored degree data
 * (`rootOffset` / `suffix` / `bassOffset`). The `displayName` (and slash bass note)
 * are absolute pitches so they are respelled per key; the `degreeLabel` is
 * key-invariant — for slash/on-chords the bass denominator is rendered as a DEGREE
 * (e.g. "I/III"), which also canonicalizes any legacy note-name denominators.
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
    degreeLabel = `${degreeNumerator(event.degreeLabel)}/${degreeLabelFromOffset(event.bassOffset)}`;
  }

  return { ...event, displayName, degreeLabel, bassNote };
}

/** Transpose a whole progression to `key` (the "移調" action — moves the song). */
export function transposeProgression(progression: ChordEvent[], key: MajorKey): ChordEvent[] {
  return progression.map((e) => transposeEvent(e, key));
}

/**
 * Recompute an event's degree label relative to its CURRENT `rootOffset`/`bassOffset`
 * (i.e. relative to whatever key the offsets are now referenced to). Used after
 * {@link rebaseProgression} when recalling a stored progression at absolute pitch:
 * the sound is preserved, but the label should read in the current key's context
 * (e.g. a source "I" landing on the 5th degree becomes "V"). Name/suffix untouched.
 */
export function relabelDegreesForKey(event: ChordEvent): ChordEvent {
  if (event.rootOffset == null) return event;
  const base = rootDegreeLabel(event.rootOffset);
  const degreeLabel =
    event.bassOffset != null ? `${base}/${degreeLabelFromOffset(event.bassOffset)}` : base;
  return { ...event, degreeLabel };
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
