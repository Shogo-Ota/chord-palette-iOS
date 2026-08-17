/**
 * Adapter: build the engine's `PerfChord[]` from a real (degree-based) progression
 * plus a key. Shared Compact Base Voicing is resolved exactly once here, before a
 * style is selected. Block, Natural and City therefore receive identical harmonic
 * pitches and may differ only in timing, dynamics and subtractive masks.
 */

import { chordArpeggioNotes, progressionToChordSpecs } from '@/lib/voicing';
import { buildCompactBaseVoicings, type VoicingPosition } from './baseVoicing';
import { chordHarmonyFromEvent } from './humanTemplate/chordHarmony';
import type { ChordEvent, MajorKey } from '@/types';
import type { PerfChord } from './PerformanceEngine';
import type { VoiceLeadingOptions } from './voiceLeading';

/**
 * `octaveShift` moves the entire hand model in octaves. `position` controls the
 * non-slash bass degree; explicit slash bass always overrides it.
 */
export function progressionToPerfChords(
  progression: ChordEvent[],
  key: MajorKey,
  octaveShift = 0,
  position: VoicingPosition = 'root',
): PerfChord[] {
  const harmonies = progression.map((event) => chordHarmonyFromEvent(event, key));
  const baseVoicings = buildCompactBaseVoicings(harmonies, { position, octaveShift });
  let beat = 0;
  return baseVoicings.map((voicing, index) => {
    const event = progression[index]!;
    const chord: PerfChord = {
      bassMidi: voicing.notes.filter((note) => note.hand === 'LH').map((note) => note.pitch),
      bodyMidi: voicing.notes.filter((note) => note.hand === 'RH').map((note) => note.pitch),
      harmony: voicing.harmony,
      // Root-position source for the arpeggio style (1-3-5-7 up/down, tensions incl.).
      arpMidi: chordArpeggioNotes(event, key).map((note) => note + octaveShift * 12),
      startBeat: beat,
      durationBeats: event.durationBeats,
    };
    beat += event.durationBeats;
    return chord;
  });
}

/**
 * DEPRECATED ANALYSIS ONLY: reconstructs the pre-Shared-Base authoring path so
 * pinned historical baselines remain reproducible. Shipping sessions must never
 * call this function.
 */
export function progressionToLegacyPerfChords(
  progression: ChordEvent[],
  key: MajorKey,
  octaveShift = 0,
  aesthetic?: VoiceLeadingOptions,
): PerfChord[] {
  const specs = progressionToChordSpecs(progression, key, aesthetic);
  const semitones = octaveShift * 12;
  let beat = 0;
  return specs.map((spec, index) => {
    const event = progression[index]!;
    const chord: PerfChord = {
      bassMidi: spec.midiNotes.filter((note) => note < 48).map((note) => note + semitones),
      bodyMidi: spec.midiNotes.filter((note) => note >= 48).map((note) => note + semitones),
      harmony: chordHarmonyFromEvent(event, key),
      arpMidi: chordArpeggioNotes(event, key).map((note) => note + semitones),
      startBeat: beat,
      durationBeats: spec.lengthBeats,
    };
    beat += spec.lengthBeats;
    return chord;
  });
}
