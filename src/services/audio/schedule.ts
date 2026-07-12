/**
 * Pure scheduling math for the audio engine (Phase 2A). No native imports so it
 * is fully unit-testable. The native `Scheduler` mirrors this math on the audio
 * sample clock; JS never schedules individual notes (§4.2).
 *
 * Timing invariants:
 *  - Every event time is derived from a common base + its ABSOLUTE beat.
 *  - We never accumulate per-event error (no "previous end + delta" chains).
 *  - Loop N is computed from an absolute beat (N * totalBeats + beat), so no
 *    cumulative drift is carried across loop boundaries.
 */

import {
  VOLUME_MAX,
  VOLUME_MIN,
  type NoteEvent,
  type PlaybackRequest,
} from '@/services/audio/types';

/** Clamp a linear volume into [0, 1]. */
export function clampVolume(value: number): number {
  if (Number.isNaN(value)) return VOLUME_MIN;
  return Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, value));
}

/** Seconds per quarter-note beat at the given tempo (4/4). */
export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** Absolute beat of a within-loop beat on loop `loopIndex` (0-based). */
export function absoluteBeat(loopIndex: number, totalBeats: number, beatWithinLoop: number): number {
  return loopIndex * totalBeats + beatWithinLoop;
}

/**
 * Integer sample offset (from playback start) for an absolute beat. Rounding to
 * whole samples keeps the schedule deterministic and sample-accurate.
 */
export function beatToSample(absBeat: number, bpm: number, sampleRate: number): number {
  return Math.round(absBeat * secondsPerBeat(bpm) * sampleRate);
}

/**
 * Sample offsets for a set of events on a given loop. Each is computed from the
 * absolute beat — independent of the others — so there is no error accumulation.
 */
export function eventSampleTimes(
  events: Pick<NoteEvent, 'startBeat'>[],
  bpm: number,
  sampleRate: number,
  loopIndex: number,
  totalBeats: number,
): number[] {
  return events.map((e) =>
    beatToSample(absoluteBeat(loopIndex, totalBeats, e.startBeat), bpm, sampleRate),
  );
}

/** Sample offset of the start of loop `loopIndex`. */
export function loopBaseSample(
  loopIndex: number,
  totalBeats: number,
  bpm: number,
  sampleRate: number,
): number {
  return beatToSample(absoluteBeat(loopIndex, totalBeats, 0), bpm, sampleRate);
}

/** A minimal chord spec used to build a timeline (start beats derived here). */
export type ChordSpec = {
  midiNotes: number[];
  lengthBeats: number;
  velocity?: number;
};

/**
 * Build absolute-addressed NoteEvents from sequential chord specs. Start beats
 * accumulate from integer/rational bar lengths (exact), and totalBeats is the
 * sum — this is the loop boundary.
 */
export function buildProgression(
  chords: ChordSpec[],
  defaultVelocity = 100,
): { chordEvents: NoteEvent[]; totalBeats: number } {
  let beat = 0;
  const chordEvents: NoteEvent[] = chords.map((c) => {
    const event: NoteEvent = {
      midiNotes: c.midiNotes,
      startBeat: beat,
      lengthBeats: c.lengthBeats,
      velocity: c.velocity ?? defaultVelocity,
    };
    beat += c.lengthBeats;
    return event;
  });
  return { chordEvents, totalBeats: beat };
}

/** Total real-time duration (seconds) of one loop of the request. */
export function requestLoopSeconds(request: Pick<PlaybackRequest, 'bpm' | 'totalBeats'>): number {
  return request.totalBeats * secondsPerBeat(request.bpm);
}
