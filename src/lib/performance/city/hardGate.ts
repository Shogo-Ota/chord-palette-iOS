import { kindOfDegree, wrapPc } from '../humanTemplate/degreeRoles';
import { resolveAllowed } from '../strictV2';
import { applyVoicingMask } from '../chordComping';
import { CITY_TYPE1_GROOVE } from './cityType1Groove';
import type { CityType1Attack, CityType1Plan } from './types';

const EPS = 1e-6;
const ATOMIC_TOLERANCE_BEAT = 1 / 32;

export type CityHardGateFailure = {
  code:
    | 'illegal_harmony'
    | 'duplicate_simultaneous_pitch'
    | 'voice_crossing'
    | 'slash_bass'
    | 'midi_range'
    | 'mask_revoice'
    | 'extension_presence'
    | 'register_stability'
    | 'octave_reset'
    | 'empty_attack'
    | 'asset_onset'
    | 'asset_gate'
    | 'asset_gap'
    | 'asset_accent'
    | 'phrase_length'
    | 'source_leakage';
  chordIndex?: number;
  onsetBeat?: number;
  pitch?: number;
  message: string;
};

export type CityHardGateReport = {
  pass: boolean;
  failures: CityHardGateFailure[];
  userChordLegalityPct: number;
  duplicateSimultaneousMidi: number;
  invalidVoiceCrossing: number;
  slashBassPass: boolean;
  sourceHarmonyLeakage: number;
  pitchClampApplied: false;
  midiRangePass: boolean;
  maskSubtractionPass: boolean;
  extensionPresencePass: boolean;
  stableRegisterPass: boolean;
  unexpectedOctaveResetCount: number;
  cityQa: {
    attackCount: number;
    expectedAttackCount: number;
    attackCountPass: boolean;
    normalizedOnsetPass: boolean;
    gateStructurePass: boolean;
    restStructurePass: boolean;
    accentHierarchyPass: boolean;
    velocityContourPass: boolean;
    phraseLengthPass: boolean;
    maxRollSpreadBeat: number;
    atomicAttackGroupPass: boolean;
  };
  register: {
    leftRange: [number, number] | null;
    rightRange: [number, number] | null;
    maxBassJump: number;
    maxTopJump: number;
    maxCenterJump: number;
    maxSpanJump: number;
  };
};

function notesForAttack(plan: CityType1Plan, attack: CityType1Attack) {
  return plan.notes.filter(
    (note) =>
      note.timeBeat >= attack.onsetBeat - EPS &&
      note.timeBeat <= attack.onsetBeat + attack.rollSpreadBeat + EPS,
  );
}

function localCycleBeat(attack: CityType1Attack, chordStartBeat: number): number {
  const raw = (attack.onsetBeat - chordStartBeat) % CITY_TYPE1_GROOVE.cycleBeats;
  return raw < 0 ? raw + CITY_TYPE1_GROOVE.cycleBeats : raw;
}

function range(values: readonly number[]): [number, number] | null {
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

function center(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function validateCityType1(plan: CityType1Plan): CityHardGateReport {
  const failures: CityHardGateFailure[] = [];
  let legalNotes = 0;
  let totalNotes = 0;
  let duplicates = 0;
  let crossings = 0;
  let slashBassPass = true;
  let midiRangePass = true;
  let maskSubtractionPass = true;
  let extensionPresencePass = true;
  let normalizedOnsetPass = true;
  let gateStructurePass = true;
  let restStructurePass = true;
  let accentHierarchyPass = true;
  let velocityContourPass = true;

  const simultaneous = new Set<string>();
  for (const note of plan.notes) {
    const key = `${note.timeBeat.toFixed(9)}:${note.pitch}`;
    if (simultaneous.has(key)) {
      duplicates += 1;
      failures.push({
        code: 'duplicate_simultaneous_pitch',
        onsetBeat: note.timeBeat,
        pitch: note.pitch,
        message: `Duplicate pitch ${note.pitch} at the same NoteOn`,
      });
    }
    simultaneous.add(key);
    if (note.pitch < 0 || note.pitch > 127 || !Number.isInteger(note.pitch)) {
      midiRangePass = false;
      failures.push({
        code: 'midi_range',
        onsetBeat: note.timeBeat,
        pitch: note.pitch,
        message: `Pitch ${note.pitch} is outside integer MIDI 0-127`,
      });
    }
  }

  for (const voicing of plan.fullVoicings) {
    const fullPitches = voicing.notes.map((note) => note.pitch);
    for (let index = 1; index < fullPitches.length; index += 1) {
      if (fullPitches[index]! <= fullPitches[index - 1]!) {
        crossings += 1;
        failures.push({
          code: 'voice_crossing',
          chordIndex: voicing.chordIndex,
          message: 'Full Voicing is not strictly ascending',
        });
      }
    }
    if (!voicing.chord.harmony) continue;
    const allowed = resolveAllowed(voicing.chord.harmony);
    const slash = voicing.chord.harmony.slashBassPc;
    const chordAttacks = plan.attacks.filter((attack) => attack.chordIndex === voicing.chordIndex);
    const heardColors = new Set<number>();
    const requiredColors = new Set(
      voicing.notes.filter((note) => kindOfDegree(note.degree) === 'color').map((note) => note.pc),
    );

    for (const attack of chordAttacks) {
      const notes = notesForAttack(plan, attack);
      const selected = applyVoicingMask(voicing, attack.mask);
      const selectedPitches = new Set(selected.map((note) => note.pitch));
      if (notes.length === 0) {
        failures.push({
          code: 'empty_attack',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: 'City Attack Group has no notes',
        });
        continue;
      }
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
            message: `Pitch ${note.pitch} is outside ${allowed.symbol}`,
          });
        }
        if (!selectedPitches.has(note.pitch)) {
          maskSubtractionPass = false;
          failures.push({
            code: 'mask_revoice',
            chordIndex: voicing.chordIndex,
            onsetBeat: attack.onsetBeat,
            pitch: note.pitch,
            message: 'Mask introduced a pitch outside the stable Full Voicing subset',
          });
        }
        if (requiredColors.has(pc)) heardColors.add(pc);
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
          message: `Lowest pitch does not preserve slash bass PC ${wrapPc(slash)}`,
        });
      }

      const assetAttack = CITY_TYPE1_GROOVE.attacks[attack.cycleAttackIndex];
      const localBeat = localCycleBeat(attack, voicing.chord.startBeat);
      if (!assetAttack || Math.abs(localBeat - assetAttack.onsetBeat) > EPS) {
        normalizedOnsetPass = false;
        failures.push({
          code: 'asset_onset',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: `Onset ${localBeat} does not match City asset slot`,
        });
      }
      if (assetAttack && Math.abs(attack.durationBeat - assetAttack.durationBeat) > EPS) {
        gateStructurePass = false;
        failures.push({
          code: 'asset_gate',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: `Duration ${attack.durationBeat} does not match City asset`,
        });
      }
      const expectedGap =
        (assetAttack?.gapToNextAttackBeat ?? 0) +
        CITY_TYPE1_GROOVE.handChordRoll.measuredSpreadBeat -
        attack.rollSpreadBeat;
      if (Math.abs(attack.gapToNextAttackBeat - expectedGap) > EPS * 2) {
        restStructurePass = false;
        failures.push({
          code: 'asset_gap',
          chordIndex: voicing.chordIndex,
          onsetBeat: attack.onsetBeat,
          message: `Gap ${attack.gapToNextAttackBeat} does not match expected ${expectedGap}`,
        });
      }
    }
    for (const colorPc of requiredColors) {
      if (heardColors.has(colorPc)) continue;
      extensionPresencePass = false;
      failures.push({
        code: 'extension_presence',
        chordIndex: voicing.chordIndex,
        message: `Color pitch class ${colorPc} is absent from the City chord phrase`,
      });
    }

    const cycles = new Map<number, CityType1Attack[]>();
    for (const attack of chordAttacks) {
      const cycle = Math.floor(
        (attack.onsetBeat - voicing.chord.startBeat) / CITY_TYPE1_GROOVE.cycleBeats,
      );
      const values = cycles.get(cycle) ?? [];
      values.push(attack);
      cycles.set(cycle, values);
    }
    for (const cycleAttacks of cycles.values()) {
      const weak = cycleAttacks.find((attack) => attack.cycleAttackIndex === 4);
      const strong = cycleAttacks.filter((attack) => attack.cycleAttackIndex !== 4);
      if (
        !weak ||
        strong.length === 0 ||
        !strong.every((attack) => attack.velocity > weak.velocity)
      ) {
        accentHierarchyPass = false;
        velocityContourPass = false;
        failures.push({
          code: 'asset_accent',
          chordIndex: voicing.chordIndex,
          message: 'Measured weak fifth attack is not below all strong attacks',
        });
      }
    }
  }

  const leftPitches = plan.fullVoicings.flatMap((voicing) =>
    voicing.notes.filter((note) => note.handRole === 'LEFT').map((note) => note.pitch),
  );
  const rightPitches = plan.fullVoicings.flatMap((voicing) =>
    voicing.notes.filter((note) => note.handRole === 'RIGHT').map((note) => note.pitch),
  );
  let maxBassJump = 0;
  let maxTopJump = 0;
  let maxCenterJump = 0;
  let maxSpanJump = 0;
  let octaveResets = 0;
  for (let index = 1; index < plan.fullVoicings.length; index += 1) {
    const previous = plan.fullVoicings[index - 1]!.notes;
    const current = plan.fullVoicings[index]!.notes;
    const previousBass = Math.min(...previous.map((note) => note.pitch));
    const currentBass = Math.min(...current.map((note) => note.pitch));
    const previousRight = previous
      .filter((note) => note.handRole === 'RIGHT')
      .map((note) => note.pitch);
    const currentRight = current
      .filter((note) => note.handRole === 'RIGHT')
      .map((note) => note.pitch);
    const previousTop = Math.max(...previousRight);
    const currentTop = Math.max(...currentRight);
    const bassJump = Math.abs(currentBass - previousBass);
    const topJump = Math.abs(currentTop - previousTop);
    const centerJump = Math.abs(center(currentRight) - center(previousRight));
    const spanJump = Math.abs(currentTop - currentBass - (previousTop - previousBass));
    maxBassJump = Math.max(maxBassJump, bassJump);
    maxTopJump = Math.max(maxTopJump, topJump);
    maxCenterJump = Math.max(maxCenterJump, centerJump);
    maxSpanJump = Math.max(maxSpanJump, spanJump);
    if (bassJump >= 12 || topJump >= 12 || centerJump >= 12) octaveResets += 1;
  }
  const stableRegisterPass =
    maxBassJump < 12 && maxTopJump < 12 && maxCenterJump < 12 && maxSpanJump < 12;
  if (!stableRegisterPass) {
    failures.push({
      code: 'register_stability',
      message: `Register jumps bass=${maxBassJump}, top=${maxTopJump}, center=${maxCenterJump}, span=${maxSpanJump}`,
    });
  }
  if (octaveResets > 0) {
    failures.push({
      code: 'octave_reset',
      message: `${octaveResets} chord transition(s) contain an octave-scale reset`,
    });
  }

  const expectedAttackCount = plan.fullVoicings.reduce(
    (count, voicing) =>
      count +
      Math.ceil(voicing.chord.durationBeats / CITY_TYPE1_GROOVE.cycleBeats) *
        CITY_TYPE1_GROOVE.attacks.length,
    0,
  );
  const attackCountPass = plan.attacks.length === expectedAttackCount;
  if (!attackCountPass) {
    failures.push({
      code: 'phrase_length',
      message: `Attack count ${plan.attacks.length} != expected ${expectedAttackCount}`,
    });
  }
  const phraseLengthPass = plan.fullVoicings.every(
    (voicing) => Math.abs(voicing.chord.durationBeats % CITY_TYPE1_GROOVE.cycleBeats) <= EPS,
  );
  if (!phraseLengthPass) {
    failures.push({
      code: 'phrase_length',
      message: 'PoC chord duration is not an exact City four-beat cycle multiple',
    });
  }
  const maxRollSpreadBeat = Math.max(0, ...plan.attacks.map((attack) => attack.rollSpreadBeat));
  const atomicAttackGroupPass = maxRollSpreadBeat <= ATOMIC_TOLERANCE_BEAT + EPS;
  const sourceHarmonyLeakage = totalNotes - legalNotes;
  if (
    sourceHarmonyLeakage > 0 ||
    !CITY_TYPE1_GROOVE.sourceContract.harmonyExcluded ||
    !CITY_TYPE1_GROOVE.sourceContract.literalPitchExcluded
  ) {
    failures.push({
      code: 'source_leakage',
      message: 'City output contains non-user harmony or asset contract leakage',
    });
  }

  return {
    pass: failures.length === 0,
    failures,
    userChordLegalityPct: totalNotes === 0 ? 0 : (legalNotes / totalNotes) * 100,
    duplicateSimultaneousMidi: duplicates,
    invalidVoiceCrossing: crossings,
    slashBassPass,
    sourceHarmonyLeakage,
    pitchClampApplied: false,
    midiRangePass,
    maskSubtractionPass,
    extensionPresencePass,
    stableRegisterPass,
    unexpectedOctaveResetCount: octaveResets,
    cityQa: {
      attackCount: plan.attacks.length,
      expectedAttackCount,
      attackCountPass,
      normalizedOnsetPass,
      gateStructurePass,
      restStructurePass,
      accentHierarchyPass,
      velocityContourPass,
      phraseLengthPass,
      maxRollSpreadBeat,
      atomicAttackGroupPass,
    },
    register: {
      leftRange: range(leftPitches),
      rightRange: range(rightPitches),
      maxBassJump,
      maxTopJump,
      maxCenterJump,
      maxSpanJump,
    },
  };
}
