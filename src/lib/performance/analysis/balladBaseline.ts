/**
 * Ballad Baseline snapshot — fixed conditions for before/after comparison when
 * Measured Performance Data is introduced later.
 *
 * Conditions (owner-approved):
 *   C – G – Am – F | 4/4 | 90 BPM | relaxed (Ballad) | Piano metadata | fixed seed
 *
 * Does NOT touch accompanimentReport. Pure domain: NoteEvent[] → JSON-serializable
 * snapshot. Writing to disk is the caller's / test generator's job.
 */

import { generatePerformance } from '../PerformanceEngine';
import type { NoteEvent, TrackId } from '../NoteEvent';
import { progressionToPerfChords } from '../progressionInput';
import { maxPolyphony } from './metrics';
import { EVAL_PROGRESSIONS } from './fixtures';

/** Formal baseline id — bump only when intentionally replacing the golden file. */
export const BALLAD_BASELINE_VERSION = 'v1';

/** Fixed seed for the Ballad baseline (independent of REPORT_SEED). */
export const BALLAD_BASELINE_SEED = 20260803;

/** Package / engine label recorded in the snapshot (not a git sha). */
export const BALLAD_BASELINE_ENGINE_VERSION = '1.0.0-performance';

const BPM = 90;
const PATTERN = 'relaxed' as const;
const BEATS_PER_BAR = 4;

/** GM-ish channel mapping for the JSON event list (documentation only). */
const CHANNEL_OF: Record<TrackId, number> = {
  chord: 0,
  top: 0,
  bass: 1,
  kick: 9,
  snare: 9,
  hat: 9,
};

export interface BaselineConditions {
  progression: string;
  bpm: number;
  timeSignature: { beatsPerBar: number; beatUnit: number };
  style: 'ballad';
  pattern: typeof PATTERN;
  instrument: 'piano';
  seed: number;
  engineVersion: string;
  generatedAt: string;
  baselineVersion: string;
  drums: boolean;
}

export interface BaselineEvent {
  part: TrackId;
  noteNumber: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  channel: number;
  barIndex: number;
  beatPosition: number;
}

export interface BaselinePartStats {
  noteCount: number;
  velocityMean: number;
  velocityStandardDeviation: number;
  durationMean: number;
  minimumNote: number;
  maximumNote: number;
  polyphony: number;
  timingDeviation: number;
  invalidNoteCount: number;
}

export interface BaselineIntegrity {
  negativeStartTimeCount: number;
  nonPositiveDurationCount: number;
  pitchOutOfRangeCount: number;
  velocityOutOfRangeCount: number;
  noteOnOffInconsistencyCount: number;
  duplicateEventCount: number;
  errorCount: number;
}

export interface BalladBaseline {
  conditions: BaselineConditions;
  events: BaselineEvent[];
  partStats: Partial<Record<TrackId, BaselinePartStats>>;
  integrity: BaselineIntegrity;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

function gridDeviation(timeBeat: number): number {
  const GRID = 0.25;
  const nearest = Math.round(timeBeat / GRID) * GRID;
  return Math.abs(timeBeat - nearest);
}

function toEvent(n: NoteEvent): BaselineEvent {
  const barIndex = Math.floor(n.timeBeat / BEATS_PER_BAR + 1e-9);
  return {
    part: n.trackId,
    noteNumber: n.pitch,
    startBeat: n.timeBeat,
    durationBeats: n.durationBeat,
    velocity: n.velocity,
    channel: CHANNEL_OF[n.trackId],
    barIndex,
    beatPosition: n.timeBeat - barIndex * BEATS_PER_BAR,
  };
}

function partStats(notes: NoteEvent[]): BaselinePartStats {
  const invalid = notes.filter(isStructurallyInvalid).length;
  return {
    noteCount: notes.length,
    velocityMean: mean(notes.map((n) => n.velocity)),
    velocityStandardDeviation: stdDev(notes.map((n) => n.velocity)),
    durationMean: mean(notes.map((n) => n.durationBeat)),
    minimumNote: notes.length === 0 ? 0 : Math.min(...notes.map((n) => n.pitch)),
    maximumNote: notes.length === 0 ? 0 : Math.max(...notes.map((n) => n.pitch)),
    polyphony: maxPolyphony(notes),
    timingDeviation: mean(notes.map((n) => gridDeviation(n.timeBeat))),
    invalidNoteCount: invalid,
  };
}

/** Structural invalidity for a duration-model NoteEvent (no separate note-off). */
function isStructurallyInvalid(n: NoteEvent): boolean {
  return (
    !Number.isFinite(n.timeBeat) ||
    n.timeBeat < 0 ||
    !Number.isFinite(n.durationBeat) ||
    n.durationBeat <= 0 ||
    !Number.isInteger(n.pitch) ||
    n.pitch < 0 ||
    n.pitch > 127 ||
    !Number.isInteger(n.velocity) ||
    n.velocity < 1 ||
    n.velocity > 127
  );
}

/**
 * Note-on/off inconsistency in the duration model: non-finite end, or end before
 * start (should be impossible if duration > 0, but counted explicitly).
 */
function noteOnOffInconsistency(n: NoteEvent): boolean {
  const end = n.timeBeat + n.durationBeat;
  return !Number.isFinite(end) || end < n.timeBeat;
}

function eventKey(e: BaselineEvent): string {
  return `${e.part}|${e.noteNumber}|${e.startBeat}|${e.durationBeats}|${e.velocity}`;
}

function integrityOf(notes: NoteEvent[], events: BaselineEvent[]): BaselineIntegrity {
  let negativeStartTimeCount = 0;
  let nonPositiveDurationCount = 0;
  let pitchOutOfRangeCount = 0;
  let velocityOutOfRangeCount = 0;
  let noteOnOffInconsistencyCount = 0;
  for (const n of notes) {
    if (n.timeBeat < 0 || !Number.isFinite(n.timeBeat)) negativeStartTimeCount++;
    if (!(n.durationBeat > 0) || !Number.isFinite(n.durationBeat)) nonPositiveDurationCount++;
    if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127) pitchOutOfRangeCount++;
    if (!Number.isInteger(n.velocity) || n.velocity < 1 || n.velocity > 127) {
      velocityOutOfRangeCount++;
    }
    if (noteOnOffInconsistency(n)) noteOnOffInconsistencyCount++;
  }
  const seen = new Map<string, number>();
  for (const e of events) {
    const k = eventKey(e);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  let duplicateEventCount = 0;
  for (const c of seen.values()) if (c > 1) duplicateEventCount += c - 1;

  const errorCount =
    negativeStartTimeCount +
    nonPositiveDurationCount +
    pitchOutOfRangeCount +
    velocityOutOfRangeCount +
    noteOnOffInconsistencyCount +
    duplicateEventCount;

  return {
    negativeStartTimeCount,
    nonPositiveDurationCount,
    pitchOutOfRangeCount,
    velocityOutOfRangeCount,
    noteOnOffInconsistencyCount,
    duplicateEventCount,
    errorCount,
  };
}

/**
 * Build the Ballad baseline snapshot. Uses EVAL progression A chords at 90 BPM
 * (not progression A's default 120) and the production `relaxed` path with drums.
 */
export function buildBalladBaseline(
  now: () => string = () => new Date().toISOString(),
): BalladBaseline {
  const progA = EVAL_PROGRESSIONS.find((p) => p.id === 'A');
  if (!progA) throw new Error('EVAL_PROGRESSIONS missing progression A (C-G-Am-F)');

  const chords = progressionToPerfChords(progA.chords, progA.key);
  const notes = generatePerformance(
    { chords, bpm: BPM, seed: BALLAD_BASELINE_SEED },
    { styleId: PATTERN, drums: true },
  );

  const events = notes.map(toEvent);
  const byTrack = new Map<TrackId, NoteEvent[]>();
  for (const n of notes) {
    byTrack.set(n.trackId, [...(byTrack.get(n.trackId) ?? []), n]);
  }
  const partStatsMap: Partial<Record<TrackId, BaselinePartStats>> = {};
  for (const [track, trackNotes] of byTrack) {
    partStatsMap[track] = partStats(trackNotes);
  }

  return {
    conditions: {
      progression: 'C - G - Am - F',
      bpm: BPM,
      timeSignature: { beatsPerBar: 4, beatUnit: 4 },
      style: 'ballad',
      pattern: PATTERN,
      instrument: 'piano',
      seed: BALLAD_BASELINE_SEED,
      engineVersion: BALLAD_BASELINE_ENGINE_VERSION,
      generatedAt: now(),
      baselineVersion: BALLAD_BASELINE_VERSION,
      drums: true,
    },
    events,
    partStats: partStatsMap,
    integrity: integrityOf(notes, events),
  };
}

/**
 * Canonical path for the pinned golden baseline (versioned; overwrite only when
 * intentionally regenerating with BALLAD_BASELINE_WRITE=1).
 */
export const BALLAD_BASELINE_PINNED_PATH =
  'docs/performance/baselines/ballad_C-G-Am-F_90bpm_relaxed_piano_v1.json';

/**
 * Compare two baselines ignoring `generatedAt` (timestamps must not break
 * determinism checks).
 */
export function baselineFingerprint(b: BalladBaseline): string {
  const { generatedAt: _g, ...conditions } = b.conditions;
  return JSON.stringify({
    conditions,
    events: b.events,
    partStats: b.partStats,
    integrity: b.integrity,
  });
}
