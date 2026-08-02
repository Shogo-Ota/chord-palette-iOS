/**
 * Accompaniment quality metrics (implementation_v1.01 Phase 9).
 *
 * Pure statistics over a rendered `NoteEvent[]` — the numbers the before/after
 * comparison reads: how many notes each part plays, how varied the velocities
 * and durations are, where the parts sit in the register, how far off the grid
 * the humanize actually lands, how many out-of-chord tones sound, and how many
 * notes overlap at the densest moment. No RN/Expo/engine imports; a report is
 * just a function of (events, chords).
 */

import type { NoteEvent, TrackId } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';

export interface TrackMetrics {
  noteCount: number;
  velocityMean: number;
  velocityStdDev: number;
  durationBeatsMean: number;
  pitchMin: number;
  pitchMax: number;
  /**
   * Mean / max distance (beats) from the nearest quarter-of-a-beat grid point.
   * Humanize jitter shows up as a small mean; swing shows up as ≈0.12–0.17 on
   * the comp tracks (the pushed off-beat is the point of it).
   */
  timingDeviationMean: number;
  timingDeviationMax: number;
}

export interface PerformanceMetrics {
  totalNotes: number;
  /** Most notes sounding at once, across all tracks (chord + bass + kit). */
  maxPolyphony: number;
  /** Pitched notes whose pitch class is not in the chord sounding under them. */
  nonChordToneCount: number;
  /** Notes violating the MIDI invariants (duration ≤ 0, velocity/pitch range…). */
  invalidNoteCount: number;
  perTrack: Partial<Record<TrackId, TrackMetrics>>;
}

const GRID_BEAT = 0.25;

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

function gridDeviation(timeBeat: number): number {
  const nearest = Math.round(timeBeat / GRID_BEAT) * GRID_BEAT;
  return Math.abs(timeBeat - nearest);
}

function trackMetrics(notes: NoteEvent[]): TrackMetrics {
  const deviations = notes.map((n) => gridDeviation(n.timeBeat));
  return {
    noteCount: notes.length,
    velocityMean: mean(notes.map((n) => n.velocity)),
    velocityStdDev: stdDev(notes.map((n) => n.velocity)),
    durationBeatsMean: mean(notes.map((n) => n.durationBeat)),
    pitchMin: notes.length === 0 ? 0 : Math.min(...notes.map((n) => n.pitch)),
    pitchMax: notes.length === 0 ? 0 : Math.max(...notes.map((n) => n.pitch)),
    timingDeviationMean: mean(deviations),
    timingDeviationMax: deviations.length === 0 ? 0 : Math.max(...deviations),
  };
}

/** Most simultaneous notes: sweep note-on/note-off boundaries in time order. */
export function maxPolyphony(notes: NoteEvent[]): number {
  const edges: { t: number; d: 1 | -1 }[] = [];
  for (const n of notes) {
    edges.push({ t: n.timeBeat, d: 1 });
    edges.push({ t: n.timeBeat + n.durationBeat, d: -1 });
  }
  // Note-offs first at equal times, so an exact re-strike doesn't double-count.
  edges.sort((a, b) => a.t - b.t || a.d - b.d);
  let now = 0;
  let peak = 0;
  for (const e of edges) {
    now += e.d;
    peak = Math.max(peak, now);
  }
  return peak;
}

const PITCHED: readonly TrackId[] = ['chord', 'top', 'bass'];

/** Pitch classes the chord sounding at `beat` allows (body + bass + arp source). */
function allowedPitchClasses(chords: PerfChord[], beat: number): Set<number> | undefined {
  let active: PerfChord | undefined;
  for (const c of chords) {
    if (c.startBeat <= beat + 1e-9) active = c;
    else break;
  }
  if (!active) return undefined;
  const all = [...active.bodyMidi, ...active.bassMidi, ...(active.arpMidi ?? [])];
  return new Set(all.map((p) => ((p % 12) + 12) % 12));
}

/** Pitched notes sounding a pitch class outside the chord under them. */
export function nonChordToneCount(notes: NoteEvent[], chords: PerfChord[]): number {
  let count = 0;
  for (const n of notes) {
    if (!PITCHED.includes(n.trackId)) continue;
    const allowed = allowedPitchClasses(chords, n.timeBeat);
    if (allowed && !allowed.has(((n.pitch % 12) + 12) % 12)) count++;
  }
  return count;
}

function isInvalid(n: NoteEvent): boolean {
  return (
    !Number.isFinite(n.timeBeat) ||
    n.timeBeat < 0 ||
    !Number.isFinite(n.durationBeat) ||
    n.durationBeat <= 0 ||
    !Number.isInteger(n.velocity) ||
    n.velocity < 1 ||
    n.velocity > 127 ||
    !Number.isInteger(n.pitch) ||
    n.pitch < 0 ||
    n.pitch > 127
  );
}

/** The full metric set for one rendered take. */
export function computeMetrics(notes: NoteEvent[], chords: PerfChord[]): PerformanceMetrics {
  const perTrack: Partial<Record<TrackId, TrackMetrics>> = {};
  const byTrack = new Map<TrackId, NoteEvent[]>();
  for (const n of notes) byTrack.set(n.trackId, [...(byTrack.get(n.trackId) ?? []), n]);
  for (const [track, trackNotes] of byTrack) perTrack[track] = trackMetrics(trackNotes);
  return {
    totalNotes: notes.length,
    maxPolyphony: maxPolyphony(notes),
    nonChordToneCount: nonChordToneCount(notes, chords),
    invalidNoteCount: notes.filter(isInvalid).length,
    perTrack,
  };
}
