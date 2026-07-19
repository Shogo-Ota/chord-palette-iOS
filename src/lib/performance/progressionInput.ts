/**
 * Adapter: build the engine's `PerfChord[]` from a real (degree-based) progression
 * plus a key, reusing the existing Step-1 voice-leading path (`progressionToChordSpecs`).
 * This keeps `PerformanceEngine` decoupled from the chord-voicing details while
 * letting callers (and tests) drive it straight from a progression. Pure domain —
 * no service/native imports beyond the pure `voicing` module in the same layer.
 */

import { progressionToChordSpecs } from '@/lib/voicing';
import type { ChordEvent, MajorKey } from '@/types';
import type { PerfChord } from './PerformanceEngine';

/**
 * Split each voice-led ChordSpec (`[subBass, bass, ...body]`) into the engine's
 * bass/body parts and stamp sequential start beats from the chord lengths.
 */
export function progressionToPerfChords(progression: ChordEvent[], key: MajorKey): PerfChord[] {
  const specs = progressionToChordSpecs(progression, key);
  let beat = 0;
  return specs.map((spec) => {
    const chord: PerfChord = {
      bassMidi: spec.midiNotes.slice(0, 2),
      bodyMidi: spec.midiNotes.slice(2),
      startBeat: beat,
      durationBeats: spec.lengthBeats,
    };
    beat += spec.lengthBeats;
    return chord;
  });
}
