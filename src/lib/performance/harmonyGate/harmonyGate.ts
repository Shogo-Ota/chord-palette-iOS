/**
 * Harmony validator — detects pitches outside the sounding chord.
 *
 * This layer does not repair pitch. Illegal notes stay as generated so Identity /
 * Transpose and the degree runtime can be judged honestly. Callers that need a
 * hard fail should read `violations`.
 *
 * Timing, duration, velocity, articulation and note count are never touched.
 */

import type { NoteEvent, TrackId } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import { resolveAllowed } from '../strictV2';

/** Pitched voices. Drum voices carry percussion note numbers and are left alone. */
const GATED_TRACKS: ReadonlySet<TrackId> = new Set<TrackId>(['chord', 'bass', 'top']);

/**
 * An onset this far ahead of a chord change already belongs to the new chord —
 * micro-timing and strum spread can push an attack slightly early.
 */
const ANTICIPATION_BEATS = 1 / 8;

export type HarmonyViolation = {
  timeBeat: number;
  pitch: number;
  pitchClass: number;
  trackId: TrackId;
};

export type HarmonyGateStats = {
  /** Pitched notes examined. */
  examined: number;
  /** Always 0 — this layer no longer snaps. Kept so existing callers compile. */
  snapped: number;
  /** Notes whose pitch class is outside the sounding chord. */
  illegal: number;
};

export type HarmonyGateResult = {
  notes: NoteEvent[];
  stats: HarmonyGateStats;
  violations: HarmonyViolation[];
};

type ChordWindow = {
  startBeat: number;
  pcs: readonly number[];
};

function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

function allowedPcsFor(chord: PerfChord): readonly number[] {
  const pcs = new Set<number>();
  if (chord.harmony) {
    for (const pc of resolveAllowed(chord.harmony).pcs) pcs.add(pc);
  }
  for (const pitch of chord.bassMidi) pcs.add(pitchClass(pitch));
  if (pcs.size === 0) {
    for (const pitch of chord.bodyMidi) pcs.add(pitchClass(pitch));
  }
  return [...pcs].sort((a, b) => a - b);
}

function windowsFor(chords: readonly PerfChord[]): ChordWindow[] {
  return chords
    .map((chord) => ({ startBeat: chord.startBeat, pcs: allowedPcsFor(chord) }))
    .sort((a, b) => a.startBeat - b.startBeat);
}

function windowIndexAt(windows: readonly ChordWindow[], beat: number): number {
  const cursor = beat + ANTICIPATION_BEATS;
  let lo = 0;
  let hi = windows.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (windows[mid]!.startBeat <= cursor) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Detect illegal pitches. Does not change any note. */
export function validateHarmony(
  notes: readonly NoteEvent[],
  chords: readonly PerfChord[],
): HarmonyViolation[] {
  if (notes.length === 0 || chords.length === 0) return [];
  const windows = windowsFor(chords);
  const violations: HarmonyViolation[] = [];
  for (const note of notes) {
    if (!GATED_TRACKS.has(note.trackId)) continue;
    const pcs = windows[windowIndexAt(windows, note.timeBeat)]!.pcs;
    const pc = pitchClass(note.pitch);
    if (pcs.length === 0 || pcs.includes(pc)) continue;
    violations.push({
      timeBeat: note.timeBeat,
      pitch: note.pitch,
      pitchClass: pc,
      trackId: note.trackId,
    });
  }
  return violations;
}

/**
 * Validate pitched notes against the chord they sound over. Returns the input
 * notes unchanged — pitch is never snapped or rewritten.
 */
export function applyHarmonyGate(
  notes: readonly NoteEvent[],
  chords: readonly PerfChord[],
): HarmonyGateResult {
  const violations = validateHarmony(notes, chords);
  const examined = notes.filter((n) => GATED_TRACKS.has(n.trackId)).length;
  return {
    notes: [...notes],
    stats: { examined, snapped: 0, illegal: violations.length },
    violations,
  };
}
