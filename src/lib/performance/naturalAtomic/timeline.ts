import { clampVelocity } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import { teacherVelocity } from '../humanTemplate/losslessTone';
import type { HumanMidiTemplate } from '../humanTemplate/types';
import type { FinalMidiControlChange } from '../finalMidi/types';
import { type1MaskSequence } from './masks';
import type { AtomicGrooveAttack, FullVoicing } from './types';

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function atomicPedalEvents(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
): FinalMidiControlChange[] {
  const events: FinalMidiControlChange[] = [];
  chords.forEach((chord, chordIndex) => {
    const barInLoop = (chordIndex % template.loopBars) + 1;
    const scale = chord.durationBeats / template.meter.beatsPerBar;
    for (const pedal of template.pedalEvents ?? []) {
      if (pedal.musicalBar !== barInLoop) continue;
      const startBeat = chord.startBeat + pedal.beatInMusicalBar * scale;
      if (startBeat < chord.startBeat || startBeat >= chord.startBeat + chord.durationBeats)
        continue;
      events.push({
        startBeat,
        controller: 64,
        value: pedal.state === 'down' ? Math.max(0, Math.min(127, pedal.value)) : 0,
        channel: 0,
      });
    }
  });
  return events.sort((left, right) => left.startBeat - right.startBeat || left.value - right.value);
}

function pedalDownAt(events: readonly FinalMidiControlChange[], beat: number): boolean {
  let down = false;
  for (const event of events) {
    if (event.startBeat > beat + 1e-9) break;
    down = event.value >= 64;
  }
  return down;
}

export function extractAtomicType1Timeline(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  voicings: readonly FullVoicing[],
): AtomicGrooveAttack[] {
  const pedalEvents = atomicPedalEvents(template, chords);
  const groups: Omit<AtomicGrooveAttack, 'mask'>[] = [];

  chords.forEach((chord, chordIndex) => {
    const barInLoop = (chordIndex % template.loopBars) + 1;
    const scale = chord.durationBeats / template.meter.beatsPerBar;
    const sourceAttacks = template.attacks.filter(
      (attack) => attack.musicalBarInLoop === barInLoop && attack.notes.length > 0,
    );
    for (const source of sourceAttacks) {
      const sounding = source.notes.filter((note) => (note.durationBeats ?? 0.5) > 0);
      if (sounding.length === 0) continue;
      const onsetBeat =
        chord.startBeat + (source.beatInMusicalBar + (source.timingOffsetBeats ?? 0)) * scale;
      groups.push({
        chordIndex,
        onsetBeat,
        durationBeat: Math.max(
          1 / 64,
          median(sounding.map((note) => note.durationBeats ?? 0.5)) * scale,
        ),
        velocity: clampVelocity(Math.round(mean(sounding.map(teacherVelocity)))),
        gapToNextAttack: null,
        pedalDown: pedalDownAt(pedalEvents, onsetBeat),
      });
    }
  });

  groups.sort((left, right) => left.onsetBeat - right.onsetBeat);
  groups.forEach((group, index) => {
    const next = groups[index + 1];
    group.gapToNextAttack = next ? next.onsetBeat - (group.onsetBeat + group.durationBeat) : null;
  });
  const masks = type1MaskSequence(groups, voicings);
  return groups.map((group, index) => ({ ...group, mask: masks[index]! }));
}
