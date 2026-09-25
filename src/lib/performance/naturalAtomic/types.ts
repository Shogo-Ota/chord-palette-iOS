import type { NoteEvent } from '../NoteEvent';
import type { FullVoicing, FullVoicingNote, PianoHandRole, VoicingMask } from '../chordComping';
import { VOICING_MASKS } from '../chordComping';
import type { OwnedControlChange } from '../style/renderOwnership';
import type { NaturalAttackVoicingSelection } from './attackVoicingPolicy';
import type { NaturalAttackVelocityShape } from './attackVelocityPolicy';

export const NATURAL_VOICING_MASKS = VOICING_MASKS;

export type NaturalVoicingMask = VoicingMask;
export type { FullVoicing, FullVoicingNote, PianoHandRole };

export type AtomicGrooveAttack = {
  /** Chord whose STYLE/rhythm authored the attack. */
  ownerChordIndex: number;
  /** Chord whose voicing the attack spells (differs only for anticipation). */
  chordIndex: number;
  onsetBeat: number;
  durationBeat: number;
  velocity: number;
  velocityShape?: NaturalAttackVelocityShape;
  gapToNextAttack: number | null;
  pedalDown: boolean;
  mask: NaturalVoicingMask;
  selection: NaturalAttackVoicingSelection;
};

export type AtomicNaturalPlan = {
  fullVoicings: FullVoicing[];
  attacks: AtomicGrooveAttack[];
  notes: NoteEvent[];
  controlChanges: OwnedControlChange[];
};

export type AtomicHardGateFailure = {
  code:
    | 'illegal_harmony'
    | 'duplicate_simultaneous_pitch'
    | 'voice_crossing'
    | 'slash_bass'
    | 'midi_range'
    | 'color_presence'
    | 'empty_attack'
    | 'hand_role';
  chordIndex: number;
  onsetBeat?: number;
  pitch?: number;
  message: string;
};

export type AtomicHardGateReport = {
  pass: boolean;
  failures: AtomicHardGateFailure[];
  userChordLegalityPct: number;
  duplicateSimultaneousMidi: number;
  invalidVoiceCrossing: number;
  slashBassPass: boolean;
  colorPresencePass: boolean;
};
