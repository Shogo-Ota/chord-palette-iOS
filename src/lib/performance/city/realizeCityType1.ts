import { clampVelocity, type NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import {
  applyVoicingMask,
  fullVoicingsFromPerfChords,
  type FullVoicingNote,
} from '../chordComping';
import { CITY_TYPE1_CANDIDATE_POLICIES, CITY_TYPE1_GROOVE } from './cityType1Groove';
import type { CityType1Attack, CityType1CandidateId, CityType1Plan } from './types';

const BASE_ATTACK_VELOCITY = 82;
const REFERENCE_VOICE_COUNT = 3;
const EPS = 1e-9;

function noteVelocity(relativeVelocity: number, voiceCount: number): number {
  const energyScale = Math.min(1.05, Math.sqrt(REFERENCE_VOICE_COUNT / Math.max(1, voiceCount)));
  return clampVelocity(Math.round(BASE_ATTACK_VELOCITY * relativeVelocity * energyScale));
}

function rollOffsets(notes: readonly FullVoicingNote[], enabled: boolean): Map<number, number> {
  const result = new Map<number, number>();
  const ordered = [...notes].sort((left, right) => left.pitch - right.pitch);
  if (!enabled || ordered.length <= 1) {
    for (const note of ordered) result.set(note.pitch, 0);
    return result;
  }
  const measured = CITY_TYPE1_GROOVE.handChordRoll.offsetsBeatByAscendingPitchRank;
  if (ordered.length === measured.length) {
    ordered.forEach((note, index) => result.set(note.pitch, measured[index]!));
    return result;
  }
  const spread = CITY_TYPE1_GROOVE.handChordRoll.measuredSpreadBeat;
  ordered.forEach((note, index) => {
    result.set(note.pitch, (index / (ordered.length - 1)) * spread);
  });
  return result;
}

export function realizeCityType1(
  chords: readonly PerfChord[],
  candidateId: CityType1CandidateId,
  seed: number,
): CityType1Plan {
  const policy = CITY_TYPE1_CANDIDATE_POLICIES[candidateId];
  const fullVoicings = fullVoicingsFromPerfChords(chords);
  const attacks: CityType1Attack[] = [];
  const notes: NoteEvent[] = [];

  for (const voicing of fullVoicings) {
    const chord = voicing.chord;
    const chordEnd = chord.startBeat + chord.durationBeats;
    for (
      let cycleStart = chord.startBeat;
      cycleStart < chordEnd - EPS;
      cycleStart += CITY_TYPE1_GROOVE.cycleBeats
    ) {
      CITY_TYPE1_GROOVE.attacks.forEach((gesture, cycleAttackIndex) => {
        const onsetBeat = cycleStart + gesture.onsetBeat;
        if (onsetBeat >= chordEnd - EPS) return;
        const mask = policy.masks[cycleAttackIndex] ?? 'FULL';
        const selected = applyVoicingMask(voicing, mask);
        if (selected.length === 0) return;
        const offsets = rollOffsets(selected, policy.useHandChordRoll);
        const rollSpreadBeat = Math.max(0, ...offsets.values());
        const durationBeat = Math.min(gesture.durationBeat, chordEnd - onsetBeat - rollSpreadBeat);
        if (durationBeat <= EPS) return;
        const velocity = noteVelocity(gesture.relativeVelocity, selected.length);

        attacks.push({
          chordIndex: voicing.chordIndex,
          cycleAttackIndex,
          onsetBeat,
          durationBeat,
          gapToNextAttackBeat: 0,
          velocity,
          mask,
          rollSpreadBeat,
        });
        for (const note of selected) {
          notes.push({
            timeBeat: onsetBeat + (offsets.get(note.pitch) ?? 0),
            durationBeat,
            pitch: note.pitch,
            velocity,
            articulation: 'normal',
            rrIndex: 0,
            trackId: 'chord',
            seed,
          });
        }
      });
    }
  }

  attacks.sort(
    (left, right) =>
      left.onsetBeat - right.onsetBeat ||
      left.chordIndex - right.chordIndex ||
      left.cycleAttackIndex - right.cycleAttackIndex,
  );
  const planEnd = chords.reduce(
    (end, chord) => Math.max(end, chord.startBeat + chord.durationBeats),
    0,
  );
  const loopLeadInBeat = attacks[0]?.onsetBeat ?? 0;
  attacks.forEach((attack, index) => {
    const nextOnset = attacks[index + 1]?.onsetBeat ?? planEnd + loopLeadInBeat;
    const releaseBeat = attack.onsetBeat + attack.durationBeat + attack.rollSpreadBeat;
    attack.gapToNextAttackBeat = Math.max(0, nextOnset - releaseBeat);
  });
  notes.sort(
    (left, right) =>
      left.timeBeat - right.timeBeat ||
      left.pitch - right.pitch ||
      left.durationBeat - right.durationBeat,
  );

  return {
    candidateId,
    fullVoicings,
    attacks,
    notes,
    // The measured City source contains no CC64. Absence is intentional rather
    // than a playback-path loss.
    controlChanges: [],
  };
}
