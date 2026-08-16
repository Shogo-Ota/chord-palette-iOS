/**
 * Adapter: build the engine's `PerfChord[]` from a real (degree-based) progression
 * plus a key, reusing the existing Step-1 voice-leading path (`progressionToChordSpecs`).
 * This keeps `PerformanceEngine` decoupled from the chord-voicing details while
 * letting callers (and tests) drive it straight from a progression. Pure domain —
 * no service/native imports beyond the pure `voicing` module in the same layer.
 */

import { chordArpeggioNotes, progressionToChordSpecs } from '@/lib/voicing';
import { chordHarmonyFromEvent } from './humanTemplate/chordHarmony';
import type { ChordEvent, MajorKey } from '@/types';
import type { PerfChord } from './PerformanceEngine';
import type { VoiceLeadingOptions } from './voiceLeading';

/**
 * Split each voice-led ChordSpec into bass (< C3) and body (≥ C3), matching the
 * native `isBass` / `isBody` split. Bass length is 1 after audit P0-2 (C2 only).
 *
 * `octaveShift` (in octaves, default 0) is the device-level register preference
 * (bass floor C2 vs C3). CRITICAL: the C3(48) bass/body split is computed on the
 * UNSHIFTED voicing, then the shift is applied to each part — otherwise raising
 * the bass to C3 would push it across the 48 threshold and misclassify it as body
 * (leaving the bass track empty). Shifting after the split keeps bass-below-body.
 *
 * `aesthetic` (optional) selects the voicing aesthetic (inversion/octave placement).
 * Omitted = the engine default (`balanced`) — identical to the previous output, so
 * existing callers are unaffected. See `VOICING_AESTHETICS`.
 */
export function progressionToPerfChords(
  progression: ChordEvent[],
  key: MajorKey,
  octaveShift = 0,
  aesthetic?: VoiceLeadingOptions,
): PerfChord[] {
  const specs = progressionToChordSpecs(progression, key, aesthetic);
  const semis = 12 * octaveShift;
  let beat = 0;
  return specs.map((spec, i) => {
    const chord: PerfChord = {
      bassMidi: spec.midiNotes.filter((n) => n < 48).map((n) => n + semis),
      bodyMidi: spec.midiNotes.filter((n) => n >= 48).map((n) => n + semis),
      harmony: chordHarmonyFromEvent(progression[i]!, key),
      // Root-position source for the arpeggio style (1-3-5-7 up/down, tensions incl.).
      arpMidi: chordArpeggioNotes(progression[i], key).map((n) => n + semis),
      startBeat: beat,
      durationBeats: spec.lengthBeats,
    };
    beat += spec.lengthBeats;
    return chord;
  });
}
