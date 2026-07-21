import { degreeLabelFromOffset, noteAt } from '@/data/music';
import type { ChordEvent, MajorKey, Preset } from '@/types';

/** A preset-built chord ready to place on the timeline (id assigned by the editor). */
export type PresetEvent = Omit<ChordEvent, 'id'>;

/** Numerator (everything before the LAST '/') of a slash degree label. */
function degreeNumerator(degreeLabel: string): string {
  const i = degreeLabel.lastIndexOf('/');
  return i >= 0 ? degreeLabel.slice(0, i) : degreeLabel;
}

/**
 * Build a concrete progression from a degree-based preset, transposed to `key`.
 * Auto-transposition falls out of storing chords by semitone offset from the tonic.
 */
export function buildPresetProgression(preset: Preset, key: MajorKey): PresetEvent[] {
  return preset.chords.map((c) => {
    const root = noteAt(key, c.offset);
    // Slash/on-chords: recompute the bass note for the target key so presets stay
    // transposable, and append it to the display name (e.g. "C/E").
    const bassNote = c.bassOffset != null ? noteAt(key, c.bassOffset) : undefined;
    const displayName = bassNote ? `${root}${c.suffix}/${bassNote}` : `${root}${c.suffix}`;
    // Bass denominator is shown as a degree (key-invariant), e.g. "I/III".
    const degreeLabel =
      c.bassOffset != null
        ? `${degreeNumerator(c.degreeLabel)}/${degreeLabelFromOffset(c.bassOffset)}`
        : c.degreeLabel;
    return {
      chordId: displayName,
      displayName,
      degreeLabel,
      function: c.function,
      durationBeats: c.durationBeats,
      isPro: false,
      rootOffset: c.offset,
      suffix: c.suffix,
      ...(c.bassOffset != null ? { bassOffset: c.bassOffset } : {}),
      ...(bassNote ? { bassNote } : {}),
      ...(c.variation ? { variation: c.variation } : {}),
    };
  });
}
