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

  chords.forEach((chord, chordIndex) => {
    const sourceAttacks = naturalRhythmForChord(strategy, chordIndex, chord.durationBeats);
    for (const source of sourceAttacks) {
      const onsetBeat = chord.startBeat + source.onsetBeat;
      groups.push({
        chordIndex,
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
