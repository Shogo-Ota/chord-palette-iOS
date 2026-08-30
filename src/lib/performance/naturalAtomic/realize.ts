import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { HumanMidiTemplate } from '../humanTemplate/types';
import { fullVoicingsFromPerfChords } from '../chordComping';
import { selectNaturalAttackNotes } from './attackVoicingPolicy';
import { velocityForNaturalAttackNote } from './attackVelocityPolicy';
import { naturalPedalEvents } from './pedalPolicy';
import { naturalRhythmStrategyFor } from './rhythmProfiles';
import { extractAtomicNaturalTimeline } from './timeline';
import type { AtomicNaturalPlan } from './types';

export function realizeAtomicNatural(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  seed: number,
  variantId: unknown,
): AtomicNaturalPlan {
  const fullVoicings = fullVoicingsFromPerfChords(chords);
  const strategy = naturalRhythmStrategyFor(variantId);
  const attacks = extractAtomicNaturalTimeline(template, chords, fullVoicings, variantId);
  const notes: NoteEvent[] = [];

  if (strategy.sustainBass) {
    for (const voicing of fullVoicings) {
      const bass = voicing.notes
        .filter((note) => note.handRole === 'LEFT')
        .sort((left, right) => left.pitch - right.pitch)[0];
      if (!bass) continue;
      notes.push({
        timeBeat: voicing.chord.startBeat,
        durationBeat: voicing.chord.durationBeats,
        pitch: bass.pitch,
        velocity: 84,
        articulation: 'legato',
        rrIndex: 0,
        trackId: 'bass',
        seed,
      });
    }
  }

  for (const attack of attacks) {
    const voicing = fullVoicings.find((candidate) => candidate.chordIndex === attack.chordIndex);
    if (!voicing) continue;
    const selectedNotes = selectNaturalAttackNotes(voicing, attack.selection);
    const harmonyTargetChordIndex =
      attack.onsetBeat < voicing.chord.startBeat - 1e-9 ? attack.chordIndex : undefined;
    for (const note of selectedNotes) {
      notes.push({
        timeBeat: attack.onsetBeat,
        durationBeat: attack.durationBeat,
        pitch: note.pitch,
        velocity: velocityForNaturalAttackNote(
          note,
          selectedNotes,
          attack.velocity,
          attack.velocityShape,
        ),
        articulation: 'normal',
        rrIndex: 0,
        trackId: 'chord',
        ...(harmonyTargetChordIndex == null ? {} : { harmonyTargetChordIndex }),
        seed,
      });
    }
  }

  notes.sort((left, right) => left.timeBeat - right.timeBeat || left.pitch - right.pitch);
  return {
    fullVoicings,
    attacks,
    notes,
    controlChanges: naturalPedalEvents(template, chords, strategy.id),
  };
}

/** Compatibility entry point for the approved Type1 PoC and analysis harnesses. */
export function realizeAtomicNaturalType1(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  seed: number,
): AtomicNaturalPlan {
  return realizeAtomicNatural(template, chords, seed, 'natural.type1');
}
