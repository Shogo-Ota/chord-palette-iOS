import type { FinalMidiControlChange } from '../finalMidi/types';
import type { HumanMidiTemplate } from '../humanTemplate/types';
import type { PerfChord } from '../PerformanceEngine';
import { mapNaturalSourceOnset, naturalDurationPolicy } from './durationPolicy';
import { grooveProfileForVariant, type RegisteredGrooveProfile } from './grooveProfileRegistry';
import { naturalRhythmStrategyFor } from './rhythmProfiles';

function midiValue(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function sorted(events: FinalMidiControlChange[]): FinalMidiControlChange[] {
  return events.sort((left, right) => left.startBeat - right.startBeat || left.value - right.value);
}

function templatePedalEvents(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
): FinalMidiControlChange[] {
  const events: FinalMidiControlChange[] = [];
  chords.forEach((chord, chordIndex) => {
    const barInLoop = (chordIndex % template.loopBars) + 1;
    const policy = naturalDurationPolicy(chord.durationBeats, template.meter.beatsPerBar);
    let pedalDown = false;
    for (const pedal of template.pedalEvents ?? []) {
      if (pedal.musicalBar !== barInLoop) continue;
      const mappedOnset = mapNaturalSourceOnset(pedal.beatInMusicalBar, policy);
      if (mappedOnset == null) continue;
      const value = pedal.state === 'down' ? midiValue(pedal.value) : 0;
      events.push({
        startBeat: chord.startBeat + mappedOnset,
        controller: 64,
        value,
        channel: 0,
      });
      pedalDown = value >= 64;
    }
    if (pedalDown) {
      events.push({
        startBeat: chord.startBeat + chord.durationBeats,
        controller: 64,
        value: 0,
        channel: 0,
      });
    }
  });
  return sorted(events);
}

function candidatePedalEvents(
  profile: RegisteredGrooveProfile,
  chords: readonly PerfChord[],
): FinalMidiControlChange[] {
  const events: FinalMidiControlChange[] = [];

  chords.forEach((chord, chordIndex) => {
    const policy = naturalDurationPolicy(chord.durationBeats, 4);
    const pedalProfile = profile.pedalByBar[chordIndex % profile.pedalByBar.length] ?? [];
    let pedalDown = false;
    for (const pedal of pedalProfile) {
      const mappedOnset = mapNaturalSourceOnset(pedal.onsetBeat, policy);
      if (mappedOnset == null) continue;
      const value = midiValue(pedal.value);
      events.push({
        startBeat: chord.startBeat + mappedOnset,
        controller: 64,
        value,
        channel: 0,
      });
      pedalDown = value >= 64;
    }
    if (pedalProfile.length > 0 || pedalDown) {
      events.push({
        startBeat: chord.startBeat + chord.durationBeats,
        controller: 64,
        value: 0,
        channel: 0,
      });
    }
  });

  return sorted(events);
}

/**
 * Single Natural CC64 authority shared by the atomic plan and canonical Final MIDI.
 * Note gates are never stretched here; releaseCut remains the caller-owned override.
 */
export function naturalPedalEvents(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  variantId: unknown,
): FinalMidiControlChange[] {
  const strategy = naturalRhythmStrategyFor(variantId);
  if (strategy.pedalPolicy === 'TEMPLATE') return templatePedalEvents(template, chords);
  const profile = grooveProfileForVariant(variantId);
  if (strategy.pedalPolicy === 'CANDIDATE' && profile) {
    return candidatePedalEvents(profile, chords);
  }
  return [];
}
