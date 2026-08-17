/**
 * Sustain pedal (CC64) from Human MIDI Template pedal events — export consumer only.
 * Does not alter Performance Engine or playback paths.
 */

import { humanTemplateById } from '../humanTemplate';
import { mapNaturalSourceOnset, naturalDurationPolicy } from '../naturalAtomic/durationPolicy';
import type { PerfChord } from '../PerformanceEngine';
import type { FinalMidiControlChange } from './types';

export function pedalCcFromHumanTemplate(
  humanTemplateId: string | undefined,
  chords: PerfChord[],
): FinalMidiControlChange[] {
  if (!humanTemplateId || chords.length === 0) return [];
  const template = humanTemplateById(humanTemplateId);
  if (!template?.pedalEvents?.length) return [];

  const loopBars = template.loopBars;
  const out: FinalMidiControlChange[] = [];

  chords.forEach((chord, chordIndex) => {
    const barInLoop = (chordIndex % loopBars) + 1;
    const policy = naturalDurationPolicy(chord.durationBeats, template.meter.beatsPerBar);
    let pedalDown = false;

    for (const pedal of template.pedalEvents!) {
      if (pedal.musicalBar !== barInLoop) continue;
      const mappedOnset = mapNaturalSourceOnset(pedal.beatInMusicalBar, policy);
      if (mappedOnset == null) continue;
      const value = pedal.state === 'down' ? Math.max(0, Math.min(127, pedal.value)) : 0;
      out.push({
        startBeat: chord.startBeat + mappedOnset,
        controller: 64,
        value,
        channel: 0,
      });
      pedalDown = value >= 64;
    }
    if (pedalDown) {
      out.push({
        startBeat: chord.startBeat + chord.durationBeats,
        controller: 64,
        value: 0,
        channel: 0,
      });
    }
  });

  out.sort((a, b) => a.startBeat - b.startBeat || a.value - b.value);
  return out;
}
