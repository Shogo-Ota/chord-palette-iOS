/**
 * Sustain pedal (CC64) from Human MIDI Template pedal events — export consumer only.
 * Does not alter Performance Engine or playback paths.
 */

import { humanTemplateById } from '../humanTemplate';
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
    const chordEnd = chord.startBeat + chord.durationBeats;

    for (const pedal of template.pedalEvents!) {
      if (pedal.musicalBar !== barInLoop) continue;
      const absBeat = chord.startBeat + pedal.beatInMusicalBar;
      if (absBeat < chord.startBeat - 1e-9 || absBeat >= chordEnd - 1e-9) continue;
      out.push({
        startBeat: absBeat,
        controller: 64,
        value: pedal.state === 'down' ? Math.max(0, Math.min(127, pedal.value)) : 0,
        channel: 0,
      });
    }
  });

  out.sort((a, b) => a.startBeat - b.startBeat || a.value - b.value);
  return out;
}
