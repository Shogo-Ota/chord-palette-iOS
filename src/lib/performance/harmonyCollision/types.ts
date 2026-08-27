/**
 * HarmonyCollisionValidator — shared vocabulary.
 *
 * Pure domain types: no React Native, no Expo, no audio service. Every threshold
 * lives in an {@link InstrumentCollisionProfile} so a future instrument can widen
 * or narrow its low-register requirement without editing rule code.
 *
 * A collision is always judged on real MIDI note numbers. Pitch class alone never
 * decides: `B3 + C4` and `C4 + B4` share an interval class and reach opposite
 * verdicts because their sounding distance is 1 and 11 semitones.
 */

import type { TrackId } from '../NoteEvent';

export type HarmonyCollisionRuleId =
  | 'NON_CHORD_TONE'
  | 'INSTRUMENT_RANGE'
  | 'DUPLICATE_NOTE'
  | 'LOW_INTERVAL_LIMIT'
  | 'MINOR_SECOND'
  | 'MINOR_NINTH'
  | 'MAJOR_SECOND'
  | 'TRITONE'
  | 'MAJOR_SEVENTH'
  | 'OCTAVE';

export type HarmonyCollisionResult = 'REJECT' | 'MERGE' | 'ALLOW';

/**
 * `normal` is the only mode production uses. The other two are the escape hatches
 * the contract reserves and does not yet implement: `ornament` will admit passing
 * and approach tones outside the chord, `cluster` will admit close minor seconds
 * for a deliberate cluster voicing. Nothing may bypass a rule without naming a mode.
 */
export type HarmonyCollisionMode = 'normal' | 'ornament' | 'cluster';

/** Below `belowPitch`, an overlapping pair must span at least `minDistance`. */
export type LowIntervalLimit = {
  readonly belowPitch: number;
  readonly minDistance: number;
};

export type InstrumentCollisionProfile = {
  readonly id: string;
  readonly lowestPitch: number;
  readonly highestPitch: number;
  /** Evaluated in order; the first matching window decides. */
  readonly lowIntervalLimits: readonly LowIntervalLimit[];
  /** Under this pitch a major second collides unless the symbol names a 9th. */
  readonly majorSecondFloor: number;
};

/** The sounding chord an overlapping pair is judged against. */
export type HarmonyCollisionChord = {
  readonly symbol: string;
  readonly rootPc: number;
  readonly allowedPitchClasses: readonly number[];
  /** Pitch classes the symbol names as a tension. */
  readonly tensionPcs: readonly number[];
  /** Pitch classes the symbol names as a ♭9 — the only minor-ninth exception. */
  readonly flatNinthPcs: readonly number[];
  /** The symbol names a 9th (9 / add9 / ♭9 / ♯9) — the major-second exception. */
  readonly carriesNinth: boolean;
  readonly startBeat: number;
};

/** One sounding note, reduced to what a collision rule needs. */
export type HarmonyCollisionNote = {
  readonly midiNote: number;
  readonly pitchClass: number;
  readonly startBeat: number;
  readonly endBeat: number;
  readonly trackId: TrackId;
};

/** Everything the contract requires a reject to record. */
export type HarmonyCollisionViolation = {
  readonly ruleId: HarmonyCollisionRuleId;
  readonly result: HarmonyCollisionResult;
  readonly reason: string;
  readonly chordSymbol: string;
  readonly chordRoot: number;
  readonly allowedPitchClasses: readonly number[];
  readonly noteA: string;
  readonly noteB: string | null;
  readonly midiA: number;
  readonly midiB: number | null;
  readonly intervalSemitones: number | null;
  readonly lowerNote: number | null;
  readonly styleId: string | null;
  readonly barIndex: number;
  readonly beatPosition: number;
};

export type HarmonyCollisionReport = {
  /** No `REJECT` survived the final active-note-set pass. */
  readonly ok: boolean;
  /** Pitched notes examined. */
  readonly examined: number;
  /** Overlapping pitched pairs compared. */
  readonly comparedPairs: number;
  readonly violations: readonly HarmonyCollisionViolation[];
  readonly rejects: readonly HarmonyCollisionViolation[];
  readonly countsByRule: Readonly<Partial<Record<HarmonyCollisionRuleId, number>>>;
};

export type HarmonyCollisionOptions = {
  readonly mode?: HarmonyCollisionMode;
  readonly profile?: InstrumentCollisionProfile;
  readonly styleId?: string;
  readonly beatsPerBar?: number;
};
