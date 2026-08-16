/**
 * Measurement primitives for the accompaniment quality programme.
 *
 * Everything here reads the PRODUCTION plan (`buildSessionPerformancePlan`) and
 * derives observable musical facts from it. No generation logic lives here — a
 * measurement that needed its own generator would not be measuring the product.
 */

import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { InstrumentEffect } from '@/lib/performance/effect';
import type { Tier } from '@/lib/performance/tier';
import type { AccompanimentPattern } from '@/types';

import type { GoldenProgression } from './goldenProgressions';

/** Tracks that carry pitched accompaniment. Drums are never measured here. */
const PITCHED = new Set<NoteEvent['trackId']>(['chord', 'top', 'bass']);

/** Attacks closer than this are one keyboard gesture (one Attack Group). */
export const ATTACK_GROUP_TOLERANCE_BEATS = 1 / 32;

export type MeasureCase = {
  progression: GoldenProgression;
  pattern: AccompanimentPattern;
  variantId: string;
  effect: InstrumentEffect;
  tier: Tier;
};

export function sessionFor(input: MeasureCase): PerformanceSessionInput {
  return {
    key: input.progression.key,
    tempoBpm: input.progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: input.pattern,
    accompanimentVariant: input.variantId as PerformanceSessionInput['accompanimentVariant'],
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: input.effect,
    drumMode: 'off',
    progression: input.progression.chords,
  };
}

export function planFor(input: MeasureCase): SessionPerformancePlan {
  return buildSessionPerformancePlan(sessionFor(input), input.tier);
}

export type AttackGroup = {
  onsetBeat: number;
  pitches: number[];
  /** Longest note in the group — the gesture's written length. */
  gateBeats: number;
  meanVelocity: number;
  /** Silence between this group's release and the next group's onset. */
  gapToNextAttackBeats: number;
};

/** Group pitched notes into Attack Groups, the atomic unit of directive §12. */
export function attackGroupsOf(notes: readonly NoteEvent[]): AttackGroup[] {
  const pitched = notes
    .filter((n) => PITCHED.has(n.trackId))
    .slice()
    .sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);

  const groups: { onset: number; notes: NoteEvent[] }[] = [];
  for (const note of pitched) {
    const last = groups[groups.length - 1];
    if (last && note.timeBeat - last.onset <= ATTACK_GROUP_TOLERANCE_BEATS) last.notes.push(note);
    else groups.push({ onset: note.timeBeat, notes: [note] });
  }

  return groups.map((group, index) => {
    const gate = Math.max(...group.notes.map((n) => n.durationBeat));
    const next = groups[index + 1];
    const release = group.onset + gate;
    return {
      onsetBeat: group.onset,
      pitches: group.notes.map((n) => n.pitch).sort((a, b) => a - b),
      gateBeats: gate,
      meanVelocity:
        group.notes.reduce((sum, n) => sum + n.velocity, 0) / Math.max(1, group.notes.length),
      gapToNextAttackBeats: next ? next.onset - release : 0,
    };
  });
}

export type GrooveMetrics = {
  attackGroups: number;
  meanVoicesPerAttack: number;
  meanGateBeats: number;
  meanGapToNextAttackBeats: number;
  /** Fraction of attack transitions that actually contain audible silence. */
  restRate: number;
  /** Fraction of the progression covered by at least one sounding note. */
  soundingRatio: number;
  /** Attack groups whose written note runs past the next attack (overlap). */
  overlappingAttacks: number;
};

export function grooveMetricsOf(plan: SessionPerformancePlan): GrooveMetrics {
  const groups = attackGroupsOf(plan.notes);
  if (groups.length === 0) {
    return {
      attackGroups: 0,
      meanVoicesPerAttack: 0,
      meanGateBeats: 0,
      meanGapToNextAttackBeats: 0,
      restRate: 0,
      soundingRatio: 0,
      overlappingAttacks: 0,
    };
  }
  const transitions = groups.slice(0, -1);
  const rests = transitions.filter((g) => g.gapToNextAttackBeats > 1e-6).length;
  const overlaps = transitions.filter((g) => g.gapToNextAttackBeats < -1e-6).length;

  const spans = plan.notes
    .filter((n) => PITCHED.has(n.trackId))
    .map((n) => [n.timeBeat, n.timeBeat + n.durationBeat] as const)
    .sort((a, b) => a[0] - b[0]);
  let sounding = 0;
  let cursor = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor);
    if (end > from) {
      sounding += end - from;
      cursor = end;
    }
  }

  return {
    attackGroups: groups.length,
    meanVoicesPerAttack: mean(groups.map((g) => g.pitches.length)),
    meanGateBeats: mean(groups.map((g) => g.gateBeats)),
    meanGapToNextAttackBeats: transitions.length
      ? mean(transitions.map((g) => g.gapToNextAttackBeats))
      : 0,
    restRate: transitions.length ? rests / transitions.length : 0,
    soundingRatio: plan.totalBeats > 0 ? Math.min(1, sounding / plan.totalBeats) : 0,
    overlappingAttacks: overlaps,
  };
}

export type ChordVoicingObservation = {
  chordIndex: number;
  symbol: string;
  /** Every pitch the style sounds inside this chord's own window. */
  pitches: number[];
  pitchClasses: number[];
  bass: number | null;
  top: number | null;
  center: number | null;
  span: number | null;
};

/** What pitches a style actually sounds per chord — the §29 invariance subject. */
export function voicingPerChord(plan: SessionPerformancePlan): ChordVoicingObservation[] {
  return plan.chords.map((chord, chordIndex) => {
    const start = chord.startBeat;
    const end = chord.startBeat + chord.durationBeats;
    const pitches = [
      ...new Set(
        plan.notes
          .filter(
            (n) => PITCHED.has(n.trackId) && n.timeBeat >= start - 1 / 8 && n.timeBeat < end - 1e-9,
          )
          .map((n) => n.pitch),
      ),
    ].sort((a, b) => a - b);
    const bass = pitches[0] ?? null;
    const top = pitches[pitches.length - 1] ?? null;
    return {
      chordIndex,
      symbol: chord.harmony?.symbol ?? '?',
      pitches,
      pitchClasses: [...new Set(pitches.map((p) => ((p % 12) + 12) % 12))].sort((a, b) => a - b),
      bass,
      top,
      center: bass != null && top != null ? (bass + top) / 2 : null,
      span: bass != null && top != null ? top - bass : null,
    };
  });
}

export type RegisterMetrics = {
  meanBass: number | null;
  meanTop: number | null;
  meanSpan: number | null;
  maxBassJump: number;
  maxTopJump: number;
  maxCenterJump: number;
  /** Chord changes where bass or top moved by an octave or more. */
  octaveJumps: number;
  minPitch: number | null;
  maxPitch: number | null;
};

export function registerMetricsOf(observations: readonly ChordVoicingObservation[]): RegisterMetrics {
  const withPitches = observations.filter((o) => o.pitches.length > 0);
  if (withPitches.length === 0) {
    return {
      meanBass: null,
      meanTop: null,
      meanSpan: null,
      maxBassJump: 0,
      maxTopJump: 0,
      maxCenterJump: 0,
      octaveJumps: 0,
      minPitch: null,
      maxPitch: null,
    };
  }
  let maxBassJump = 0;
  let maxTopJump = 0;
  let maxCenterJump = 0;
  let octaveJumps = 0;
  for (let i = 1; i < withPitches.length; i += 1) {
    const previous = withPitches[i - 1]!;
    const current = withPitches[i]!;
    const bassJump = Math.abs((current.bass ?? 0) - (previous.bass ?? 0));
    const topJump = Math.abs((current.top ?? 0) - (previous.top ?? 0));
    maxBassJump = Math.max(maxBassJump, bassJump);
    maxTopJump = Math.max(maxTopJump, topJump);
    maxCenterJump = Math.max(maxCenterJump, Math.abs((current.center ?? 0) - (previous.center ?? 0)));
    if (bassJump >= 12 || topJump >= 12) octaveJumps += 1;
  }
  const all = withPitches.flatMap((o) => o.pitches);
  return {
    meanBass: mean(withPitches.map((o) => o.bass!)),
    meanTop: mean(withPitches.map((o) => o.top!)),
    meanSpan: mean(withPitches.map((o) => o.span!)),
    maxBassJump,
    maxTopJump,
    maxCenterJump,
    octaveJumps,
    minPitch: Math.min(...all),
    maxPitch: Math.max(...all),
  };
}

export type PedalObservation = {
  effect: InstrumentEffect;
  /** CC64 events written into the Final MIDI snapshot. */
  cc64Events: number;
  /**
   * True when the effect lengthened notes past what the engine wrote AND CC64 is
   * also present — the note lengths and the pedal would then ring the same gesture
   * twice. Needs the identity (`off`) render of the same case as the reference.
   */
  doubleSustain: boolean;
};

export function pedalObservationOf(
  plan: SessionPerformancePlan,
  /** The same case rendered with `instrumentEffect: 'off'`. */
  reference?: SessionPerformancePlan,
): PedalObservation {
  const snapshot = buildFinalMidiSnapshot(plan);
  const cc64 = snapshot.controlChanges.filter((cc) => cc.controller === 64).length;
  const stretched = reference
    ? plan.notes.some((note, index) => {
        const written = reference.notes[index];
        return written != null && note.durationBeat > written.durationBeat + 1e-9;
      })
    : false;
  return {
    effect: plan.instrumentEffect,
    cc64Events: cc64,
    doubleSustain: stretched && cc64 > 0,
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
