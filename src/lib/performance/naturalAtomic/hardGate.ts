import { kindOfDegree, wrapPc } from '../humanTemplate/degreeRoles';
import { resolveAllowed } from '../strictV2';
import { applyVoicingMask } from './masks';
import type { AtomicHardGateFailure, AtomicHardGateReport, AtomicNaturalPlan } from './types';

const EPS = 1e-6;

export function validateAtomicNatural(plan: AtomicNaturalPlan): AtomicHardGateReport {
  const failures: AtomicHardGateFailure[] = [];
  let legalNotes = 0;
  let totalNotes = 0;
  let duplicates = 0;
  let crossings = 0;
  let slashBassPass = true;
  let colorPresencePass = true;

  for (const voicing of plan.fullVoicings) {
    if (!voicing.chord.harmony) continue;
    const allowed = resolveAllowed(voicing.chord.harmony);
    const slash = voicing.chord.harmony.slashBassPc;
    const fullPitches = voicing.notes.map((note) => note.pitch);
    const left = voicing.notes.filter((note) => note.handRole === 'LEFT');
    const right = voicing.notes.filter((note) => note.handRole === 'RIGHT');
    if (
      left.length !== 1 ||
      right.length === 0 ||
      left[0]!.pitch !== Math.min(...fullPitches) ||
      right.some((note) => note.pitch <= left[0]!.pitch)
    ) {
      failures.push({
        code: 'hand_role',
        chordIndex: voicing.chordIndex,
        message: 'Full Voicing does not preserve one LH bass below the RH body',
      });
    }
    for (const note of voicing.notes) {
      const explicitSlashBass = note.isBass && slash != null && note.pc === wrapPc(slash);
      if (
        kindOfDegree(note.degree) === 'color' &&
        note.handRole !== 'RIGHT' &&
        !explicitSlashBass
      ) {
        failures.push({
          code: 'hand_role',
          chordIndex: voicing.chordIndex,
          pitch: note.pitch,
          message: `Color degree ${note.degree} is assigned outside the RH body`,
        });
      }
    }
    for (let index = 1; index < fullPitches.length; index++) {
      if (fullPitches[index]! <= fullPitches[index - 1]!) {
        crossings += 1;
        failures.push({
          code: 'voice_crossing',
          chordIndex: voicing.chordIndex,
          message: `Full Voicing is not strictly ascending at index ${index}`,
        });
      }
    }

    const attacks = plan.attacks.filter((attack) => attack.chordIndex === voicing.chordIndex);
    const colorPcs = voicing.notes
      .filter((note) => kindOfDegree(note.degree) === 'color')
      .map((note) => note.pc);
    const heardColors = new Set<number>();

    for (const attack of attacks) {
      const notes = plan.notes.filter((note) => Math.abs(note.timeBeat - attack.onsetBeat) <= EPS);
      const masked = applyVoicingMask(voicing, attack.mask);
      if (
        (attack.mask === 'ROOT_ONLY' && masked.some((note) => note.handRole !== 'LEFT')) ||
        (attack.mask === 'UPPER' && masked.some((note) => note.handRole !== 'RIGHT'))
      ) {
        failures.push({
          code: 'hand_role',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: `${attack.mask} violates its piano hand role`,
        });
      }
      if (notes.length === 0) {
        failures.push({
          code: 'empty_attack',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: 'Attack Group has no NoteOn',
        });
        continue;
      }
      const seen = new Set<number>();
      for (const note of notes) {
        totalNotes += 1;
        const pc = wrapPc(note.pitch);
        const slashException = slash != null && pc === wrapPc(slash);
        if (allowed.containsPitch(note.pitch) || slashException) legalNotes += 1;
        else {
          failures.push({
            code: 'illegal_harmony',
            chordIndex: voicing.chordIndex,
            onsetBeat: attack.onsetBeat,
            pitch: note.pitch,
            message: `Pitch ${note.pitch} is outside User Chord ${allowed.symbol}`,
          });
        }
        if (seen.has(note.pitch)) {
          duplicates += 1;
          failures.push({
            code: 'duplicate_simultaneous_pitch',
            chordIndex: voicing.chordIndex,
            onsetBeat: attack.onsetBeat,
            pitch: note.pitch,
            message: `Duplicate simultaneous MIDI pitch ${note.pitch}`,
          });
        }
        seen.add(note.pitch);
        if (note.pitch < 0 || note.pitch > 127) {
          failures.push({
            code: 'midi_range',
            chordIndex: voicing.chordIndex,
            onsetBeat: attack.onsetBeat,
            pitch: note.pitch,
            message: `Pitch ${note.pitch} is outside MIDI range`,
          });
        }
        if (colorPcs.includes(pc)) heardColors.add(pc);
      }
      if (
        slash != null &&
        attack.mask !== 'UPPER' &&
        wrapPc(Math.min(...notes.map((note) => note.pitch))) !== wrapPc(slash)
      ) {
        slashBassPass = false;
        failures.push({
          code: 'slash_bass',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: `Lowest note does not satisfy slash bass PC ${wrapPc(slash)}`,
        });
      }
    }

    for (const colorPc of new Set(colorPcs)) {
      if (heardColors.has(colorPc)) continue;
      colorPresencePass = false;
      failures.push({
        code: 'color_presence',
        chordIndex: voicing.chordIndex,
        message: `Color pitch class ${colorPc} is absent from the chord phrase`,
      });
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    userChordLegalityPct: totalNotes === 0 ? 0 : (legalNotes / totalNotes) * 100,
    duplicateSimultaneousMidi: duplicates,
    invalidVoiceCrossing: crossings,
    slashBassPass,
    colorPresencePass,
  };
}
