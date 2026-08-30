/**
 * HarmonyCollisionValidator — the hard gate for unintended dissonance.
 *
 * Guarantees a voicing is not merely theoretically correct but unlikely to sound
 * muddy: no tone the chord symbol never named, no close semitone, no minor ninth the
 * symbol never asked for, and enough air between notes in the bass register.
 *
 * Every verdict reads real MIDI note numbers. Pitch class intervals are never
 * sufficient — see {@link evaluateIntervalPair}.
 *
 * Order is fixed by contract:
 *   1. Chord membership   5. Minor second
 *   2. Instrument range   6. Minor ninth
 *   3. Duplicate note     7. Conditional dissonance
 *   4. Low interval limit 8. Final active note set
 *
 * Membership is delegated to the harmony gate rather than reimplemented, so a note
 * can never be legal for one layer and illegal for the other. This validator
 * detects and reports; it does not rewrite pitch. Repair belongs to the voicing
 * policy, where octave placements exist as candidates and harmony stays intact.
 */

import { boundPitchedNotes, overlappingPairs, type BoundNote } from './activeNoteSet';
import { harmonyCollisionChordFor } from './chordContext';
import { collisionProfileFor, PIANO_COLLISION_PROFILE } from './instrumentProfiles';
import { evaluateIntervalPair } from './intervalRules';
import { midiNoteName } from './noteNames';
import { validateHarmony } from '../harmonyGate';
import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type {
  HarmonyCollisionChord,
  HarmonyCollisionOptions,
  HarmonyCollisionReport,
  HarmonyCollisionRuleId,
  HarmonyCollisionViolation,
} from './types';

const DEFAULT_BEATS_PER_BAR = 4;

/** Two attacks closer than this are the same instant. */
const SAME_INSTANT_BEATS = 1e-6;

type ViolationDraft = {
  ruleId: HarmonyCollisionRuleId;
  result: HarmonyCollisionViolation['result'];
  reason: string;
  chord: HarmonyCollisionChord | null;
  midiA: number;
  midiB: number | null;
  beatPosition: number;
};

function buildViolation(
  draft: ViolationDraft,
  styleId: string | null,
  beatsPerBar: number,
): HarmonyCollisionViolation {
  const { chord, midiA, midiB } = draft;
  return {
    ruleId: draft.ruleId,
    result: draft.result,
    reason: draft.reason,
    chordSymbol: chord?.symbol ?? '(untitled)',
    chordRoot: chord?.rootPc ?? -1,
    allowedPitchClasses: chord?.allowedPitchClasses ?? [],
    noteA: midiNoteName(midiA),
    noteB: midiB == null ? null : midiNoteName(midiB),
    midiA,
    midiB,
    intervalSemitones: midiB == null ? null : Math.abs(midiB - midiA),
    lowerNote: midiB == null ? null : Math.min(midiA, midiB),
    styleId,
    barIndex: Math.floor(draft.beatPosition / beatsPerBar),
    beatPosition: draft.beatPosition,
  };
}

/**
 * Validate the pitched notes of a generated performance against the chords they
 * sound over. Returns a report; never mutates a note.
 */
export function validateHarmonyCollisions(
  notes: readonly NoteEvent[],
  chords: readonly PerfChord[],
  options: HarmonyCollisionOptions = {},
): HarmonyCollisionReport {
  const mode = options.mode ?? 'normal';
  const profile = options.profile ?? PIANO_COLLISION_PROFILE;
  const styleId = options.styleId ?? null;
  const beatsPerBar = options.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;
  const chordContexts = chords.map(harmonyCollisionChordFor);
  const contextAt = (index: number): HarmonyCollisionChord | null => chordContexts[index] ?? null;
  const drafts: ViolationDraft[] = [];

  const bound = boundPitchedNotes(notes, chords);

  // 1. Chord membership — the gate owns this judgement.
  if (mode !== 'ornament') {
    for (const violation of validateHarmony(notes, chords)) {
      drafts.push({
        ruleId: 'NON_CHORD_TONE',
        result: 'REJECT',
        reason: 'Pitch class outside the tones the chord symbol names.',
        chord: contextAt(bound.find((note) => note.midiNote === violation.pitch)?.chordIndex ?? -1),
        midiA: violation.pitch,
        midiB: null,
        beatPosition: violation.timeBeat,
      });
    }
  }

  // 2. Instrument range.
  for (const note of bound) {
    if (note.midiNote >= profile.lowestPitch && note.midiNote <= profile.highestPitch) continue;
    drafts.push({
      ruleId: 'INSTRUMENT_RANGE',
      result: 'REJECT',
      reason: `Outside the ${profile.id} range (${profile.lowestPitch}–${profile.highestPitch}).`,
      chord: contextAt(note.chordIndex),
      midiA: note.midiNote,
      midiB: null,
      beatPosition: note.startBeat,
    });
  }

  // 3–7. Pair rules, in contract order, first verdict per pair.
  const pairs = overlappingPairs(bound);
  for (const pair of pairs) {
    const chord = contextAt(pair.chordIndex);
    if (!chord) continue;
    // A unison struck while the same pitch is still ringing is a re-articulation the
    // rhythm asked for, not a duplicate note-on. Merging it would delete an attack,
    // so only simultaneous unisons are the duplicate the contract names.
    if (
      pair.lower.midiNote === pair.upper.midiNote &&
      Math.abs(pair.lower.startBeat - pair.upper.startBeat) > SAME_INSTANT_BEATS
    ) {
      continue;
    }
    const verdict = evaluateIntervalPair(
      pair.lower.midiNote,
      pair.upper.midiNote,
      chord,
      profile,
      mode,
    );
    if (!verdict || verdict.result === 'ALLOW') continue;
    drafts.push({
      ruleId: verdict.ruleId,
      result: verdict.result,
      reason: verdict.reason,
      chord,
      midiA: pair.lower.midiNote,
      midiB: pair.upper.midiNote,
      beatPosition: Math.max(pair.lower.startBeat, pair.upper.startBeat),
    });
  }

  const violations = drafts
    .map((draft) => buildViolation(draft, styleId, beatsPerBar))
    .sort(
      (a, b) =>
        a.beatPosition - b.beatPosition ||
        a.midiA - b.midiA ||
        (a.midiB ?? 0) - (b.midiB ?? 0) ||
        a.ruleId.localeCompare(b.ruleId),
    );

  const countsByRule: Partial<Record<HarmonyCollisionRuleId, number>> = {};
  for (const violation of violations) {
    countsByRule[violation.ruleId] = (countsByRule[violation.ruleId] ?? 0) + 1;
  }

  // 8. Final active note set — the gate passes only with no reject left standing.
  const rejects = violations.filter((violation) => violation.result === 'REJECT');
  return {
    ok: rejects.length === 0,
    examined: bound.length,
    comparedPairs: pairs.length,
    violations,
    rejects,
    countsByRule,
  };
}

/** Convenience wrapper for callers that hold an instrument id rather than a profile. */
export function validateHarmonyCollisionsForInstrument(
  notes: readonly NoteEvent[],
  chords: readonly PerfChord[],
  instrumentId: Parameters<typeof collisionProfileFor>[0],
  options: Omit<HarmonyCollisionOptions, 'profile'> = {},
): HarmonyCollisionReport {
  return validateHarmonyCollisions(notes, chords, {
    ...options,
    profile: collisionProfileFor(instrumentId),
  });
}

export type { BoundNote };
