import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { HumanMidiTemplate } from '../humanTemplate/types';
import { buildStableFullVoicings } from './fullVoicing';
import { applyVoicingMask } from './masks';
import { atomicPedalEvents, extractAtomicType1Timeline } from './timeline';
import type { AtomicNaturalPlan } from './types';

export function realizeAtomicNaturalType1(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  seed: number,
): AtomicNaturalPlan {
  const fullVoicings = buildStableFullVoicings(chords);
  const attacks = extractAtomicType1Timeline(template, chords, fullVoicings);
  const notes: NoteEvent[] = [];

  for (const attack of attacks) {
    const voicing = fullVoicings.find((candidate) => candidate.chordIndex === attack.chordIndex);
    if (!voicing) continue;
    for (const note of applyVoicingMask(voicing, attack.mask)) {
      notes.push({
        timeBeat: attack.onsetBeat,
        durationBeat: attack.durationBeat,
        pitch: note.pitch,
        velocity: attack.velocity,
        articulation: 'normal',
        rrIndex: 0,
        trackId: 'chord',
        seed,
      });
    }
  }

  notes.sort((left, right) => left.timeBeat - right.timeBeat || left.pitch - right.pitch);
  return {
    fullVoicings,
    attacks,
    notes,
    controlChanges: atomicPedalEvents(template, chords),
  };
}
