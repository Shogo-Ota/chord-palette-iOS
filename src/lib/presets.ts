import { noteAt } from '@/data/music';
import type { ChordEvent, MajorKey, Preset } from '@/types';

/** A preset-built chord ready to place on the timeline (id assigned by the editor). */
export type PresetEvent = Omit<ChordEvent, 'id'>;

/**
 * Build a concrete progression from a degree-based preset, transposed to `key`.
 * Auto-transposition falls out of storing chords by semitone offset from the tonic.
 */
export function buildPresetProgression(preset: Preset, key: MajorKey): PresetEvent[] {
  return preset.chords.map((c) => {
    const root = noteAt(key, c.offset);
    const displayName = `${root}${c.suffix}`;
    return {
      chordId: displayName,
      displayName,
      degreeLabel: c.degreeLabel,
      function: c.function,
      durationBeats: c.durationBeats,
      isPro: false,
      rootOffset: c.offset,
      suffix: c.suffix,
    };
  });
}
