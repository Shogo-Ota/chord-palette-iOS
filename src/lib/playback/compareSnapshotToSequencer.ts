/**
 * Phase 3C: Final MIDI vs sequencer playback events.
 *
 * Compares the snapshot to the messages `snapshotToMidiEvents` hands native.
 * Native then applies only the MIDI legal range 0–127 (not the sampled 24–84
 * clamp). This file does not change generation.
 */

import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import { snapshotToMidiEvents, type NativeMidiEvent } from './nativePlaybackPlan';

const BEAT_EPS = 1e-12;

export type Phase3cFidelityRow = {
  label: string;
  finalMidi: { noteOn: number; noteOff: number; cc64: number };
  sequencerPlayback: { noteOn: number; noteOff: number; cc64: number };
  pitchMismatchCount: number;
  onsetMismatchCount: number;
  noteOffMismatchCount: number;
  velocityMismatchCount: number;
  cc64MismatchCount: number;
  samplerMinMidiNote: number | null;
  samplerMaxMidiNote: number | null;
  notesAtOrAbove85: number;
  allMatch: boolean;
};

function midiLegal(n: number): number {
  return Math.max(0, Math.min(127, n));
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= BEAT_EPS;
}

function pairMismatches<T>(
  expected: T[],
  got: T[],
  eq: (a: T, b: T) => boolean,
): number {
  const n = Math.max(expected.length, got.length);
  let miss = 0;
  for (let i = 0; i < n; i++) {
    const a = expected[i];
    const b = got[i];
    if (a === undefined || b === undefined || !eq(a, b)) miss += 1;
  }
  return miss;
}

function sortByBeatThenA(events: NativeMidiEvent[]): NativeMidiEvent[] {
  return [...events].sort((x, y) => x.beat - y.beat || x.a - y.a || x.b - y.b);
}

/**
 * What the sequencer path sends the sampler for one Final MIDI snapshot.
 * Pitch 90 stays 90. CC64 is included. Pedal is not baked into duration.
 */
export function compareSnapshotToSequencer(
  snapshot: FinalMidiSnapshot,
  label: string,
): Phase3cFidelityRow {
  const events = snapshotToMidiEvents(snapshot);
  const ons = sortByBeatThenA(events.filter((e) => e.kind === 'on' && !e.drum));
  const offs = sortByBeatThenA(events.filter((e) => e.kind === 'off' && !e.drum));
  const ccs = sortByBeatThenA(events.filter((e) => e.kind === 'cc' && e.a === 64));

  const notes = [...snapshot.notes]
    .filter((n) => n.track !== 'drums')
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch || a.velocity - b.velocity);
  const pedals = [...snapshot.controlChanges]
    .filter((c) => c.controller === 64)
    .sort((a, b) => a.startBeat - b.startBeat || a.value - b.value);

  const expectedOn = notes.map((n) => ({
    beat: n.startBeat,
    pitch: n.pitch,
    vel: n.velocity,
  }));
  const gotOn = ons.map((e) => ({
    beat: e.beat,
    pitch: midiLegal(e.a),
    vel: midiLegal(e.b),
  }));

  const expectedOff = notes
    .map((n) => ({
      beat: n.startBeat + n.durationBeat,
      pitch: n.pitch,
    }))
    .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  const gotOff = offs.map((e) => ({
    beat: e.beat,
    pitch: midiLegal(e.a),
  }));

  const expectedCc = pedals.map((c) => ({ beat: c.startBeat, value: c.value }));
  const gotCc = ccs.map((e) => ({ beat: e.beat, value: midiLegal(e.b) }));

  const pitchMismatchCount = pairMismatches(expectedOn, gotOn, (a, b) => a.pitch === b.pitch);
  const onsetMismatchCount = pairMismatches(expectedOn, gotOn, (a, b) => near(a.beat, b.beat));
  const noteOffMismatchCount = pairMismatches(
    expectedOff,
    gotOff,
    (a, b) => a.pitch === b.pitch && near(a.beat, b.beat),
  );
  const velocityMismatchCount = pairMismatches(expectedOn, gotOn, (a, b) => a.vel === b.vel);
  const cc64MismatchCount = pairMismatches(
    expectedCc,
    gotCc,
    (a, b) => a.value === b.value && near(a.beat, b.beat),
  );

  const sentPitches = gotOn.map((n) => n.pitch);
  const samplerMinMidiNote = sentPitches.length ? Math.min(...sentPitches) : null;
  const samplerMaxMidiNote = sentPitches.length ? Math.max(...sentPitches) : null;

  const allMatch =
    notes.length === ons.length &&
    notes.length === offs.length &&
    pedals.length === ccs.length &&
    pitchMismatchCount === 0 &&
    onsetMismatchCount === 0 &&
    noteOffMismatchCount === 0 &&
    velocityMismatchCount === 0 &&
    cc64MismatchCount === 0;

  return {
    label,
    finalMidi: {
      noteOn: notes.length,
      noteOff: notes.length,
      cc64: pedals.length,
    },
    sequencerPlayback: {
      noteOn: ons.length,
      noteOff: offs.length,
      cc64: ccs.length,
    },
    pitchMismatchCount,
    onsetMismatchCount,
    noteOffMismatchCount,
    velocityMismatchCount,
    cc64MismatchCount,
    samplerMinMidiNote,
    samplerMaxMidiNote,
    notesAtOrAbove85: notes.filter((n) => n.pitch >= 85).length,
    allMatch,
  };
}
