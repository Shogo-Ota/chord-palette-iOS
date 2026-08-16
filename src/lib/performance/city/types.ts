import type { NoteEvent } from '../NoteEvent';
import type { FullVoicing, VoicingMask } from '../chordComping';
import type { FinalMidiControlChange } from '../finalMidi/types';

export type CityType1CandidateId = 'A_FULL' | 'B_SUBTRACTIVE' | 'C_SUBTRACTIVE_ROLL';

export type CityType1Attack = {
  chordIndex: number;
  cycleAttackIndex: number;
  onsetBeat: number;
  durationBeat: number;
  gapToNextAttackBeat: number;
  velocity: number;
  mask: VoicingMask;
  rollSpreadBeat: number;
};

export type CityType1Plan = {
  candidateId: CityType1CandidateId;
  fullVoicings: FullVoicing[];
  attacks: CityType1Attack[];
  notes: NoteEvent[];
  controlChanges: FinalMidiControlChange[];
};
