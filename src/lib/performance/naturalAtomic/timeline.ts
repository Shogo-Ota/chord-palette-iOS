import { clampVelocity } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { FinalMidiControlChange } from '../finalMidi/types';
import type { HumanMidiTemplate } from '../humanTemplate/types';
import {
  compatibilityMaskForSelection,
  type NaturalAttackVoicingSelection,
} from './attackVoicingPolicy';
import { type1MaskSequence } from './masks';
import { naturalPedalEvents } from './pedalPolicy';
import { naturalRhythmForChord, naturalRhythmStrategyFor } from './rhythmProfiles';
import type { AtomicGrooveAttack, FullVoicing } from './types';

function pedalDownAt(events: readonly FinalMidiControlChange[], beat: number): boolean {
  let down = false;
  for (const event of events) {
    if (event.startBeat > beat + 1e-9) break;
    down = event.value >= 64;
  }
  return down;
}

export function extractAtomicNaturalTimeline(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  voicings: readonly FullVoicing[],
  variantId: unknown,
): AtomicGrooveAttack[] {
  const pedalEvents = naturalPedalEvents(template, chords, variantId);
  const groups: (Omit<AtomicGrooveAttack, 'mask' | 'selection'> & {
    selection?: NaturalAttackVoicingSelection;
  })[] = [];
  const strategy = naturalRhythmStrategyFor(variantId);
  const progressionEndBeat = chords.reduce(
    (end, chord) => Math.max(end, chord.startBeat + chord.durationBeats),
    0,
  );

  chords.forEach((chord, chordIndex) => {
    const beatsPerBar = template.meter.beatsPerBar;
    const nextChord = chords[chordIndex + 1];
    const afterNextChord = chords[chordIndex + 2];
    const chordEndBeat = chord.startBeat + chord.durationBeats;
    const hasContiguousNextChord =
      nextChord != null && Math.abs(nextChord.startBeat - chordEndBeat) <= 1e-9;
    const halfBar = beatsPerBar / 2;
    const endsAtBarBoundary =
      Math.abs(chordEndBeat / beatsPerBar - Math.round(chordEndBeat / beatsPerBar)) <= 1e-9;
    const nextBarIsSplitHalfPair =
      hasContiguousNextChord &&
      nextChord != null &&
      endsAtBarBoundary &&
      Math.abs(nextChord.durationBeats - halfBar) <= 1e-9 &&
      afterNextChord != null &&
      Math.abs(afterNextChord.startBeat - (nextChord.startBeat + nextChord.durationBeats)) <=
        1e-9 &&
      Math.abs(afterNextChord.durationBeats - halfBar) <= 1e-9;
    const sourceAttacks = naturalRhythmForChord(
      strategy,
      chordIndex,
      chord.durationBeats,
      chord.startBeat,
      beatsPerBar,
      hasContiguousNextChord,
      nextBarIsSplitHalfPair,
      progressionEndBeat,
    );
    for (const source of sourceAttacks) {
      const onsetBeat = chord.startBeat + source.onsetBeat;
      const targetChordIndex = chordIndex + (source.targetChordOffset ?? 0);
      if (!chords[targetChordIndex]) continue;
      groups.push({
        chordIndex: targetChordIndex,
        onsetBeat,
        durationBeat: source.durationBeat,
        velocity: clampVelocity(source.velocity),
        velocityShape: source.velocityShape,
        gapToNextAttack: null,
        pedalDown: pedalDownAt(pedalEvents, onsetBeat),
        selection: source.selection,
      });
    }
  });

  groups.sort((left, right) => left.onsetBeat - right.onsetBeat);
  groups.forEach((group, index) => {
    const next = groups[index + 1];
    group.gapToNextAttack = next ? next.onsetBeat - (group.onsetBeat + group.durationBeat) : null;
  });
  const masks = type1MaskSequence(groups, voicings);
  return groups.map((group, index) => {
    const selection: NaturalAttackVoicingSelection =
      group.selection ??
      ({
        kind: 'MASK',
        mask: strategy.attackMask ?? masks[index]!,
      } as const);
    return {
      ...group,
      mask: compatibilityMaskForSelection(selection),
      selection,
    };
  });
}

/** Compatibility entry point for PoC/analysis callers. */
export function extractAtomicType1Timeline(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  voicings: readonly FullVoicing[],
): AtomicGrooveAttack[] {
  return extractAtomicNaturalTimeline(template, chords, voicings, 'natural.type1');
}
