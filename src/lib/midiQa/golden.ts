/**
 * Event-level Current vs Golden comparison.
 */

import { parseSmf } from '@/lib/performance/library/ingest/smf';

import type { GoldenDiff, QaFailure } from './types';

export type GoldenNote = {
  tick: number;
  pitch: number;
  velocity: number;
  durTicks: number;
};

export type GoldenSong = {
  notes: GoldenNote[];
  cc64: Array<{ tick: number; value: number }>;
};

export function songFromSmfBytes(bytes: Uint8Array): GoldenSong {
  const song = parseSmf(bytes);
  return {
    notes: song.notes
      .filter((n) => n.channel !== 9)
      .map((n) => ({
        tick: n.tick,
        pitch: n.pitch,
        velocity: n.velocity,
        durTicks: n.durTicks,
      }))
      .sort((a, b) => a.tick - b.tick || a.pitch - b.pitch),
    cc64: song.controlChanges
      .filter((c) => c.controller === 64)
      .map((c) => ({ tick: c.tick, value: c.value }))
      .sort((a, b) => a.tick - b.tick),
  };
}

export function compareGolden(caseId: string, current: GoldenSong, golden: GoldenSong | null): GoldenDiff {
  if (!golden) {
    return {
      caseId,
      present: false,
      pass: true,
      pitchDiff: 0,
      onsetDiff: 0,
      durationDiff: 0,
      velocityDiff: 0,
      ccDiff: 0,
      noteCountDiff: 0,
      failures: [],
    };
  }

  const failures: QaFailure[] = [];
  const noteCountDiff = current.notes.length - golden.notes.length;
  if (noteCountDiff !== 0) {
    failures.push({
      category: 'regression',
      code: 'note_count_diff',
      message: `current ${current.notes.length} vs golden ${golden.notes.length}`,
    });
  }

  let pitchDiff = 0;
  let onsetDiff = 0;
  let durationDiff = 0;
  let velocityDiff = 0;
  const n = Math.min(current.notes.length, golden.notes.length);
  for (let i = 0; i < n; i++) {
    const c = current.notes[i]!;
    const g = golden.notes[i]!;
    if (c.pitch !== g.pitch) pitchDiff += 1;
    if (c.tick !== g.tick) onsetDiff += 1;
    if (c.durTicks !== g.durTicks) durationDiff += 1;
    if (c.velocity !== g.velocity) velocityDiff += 1;
  }
  pitchDiff += Math.abs(noteCountDiff);
  onsetDiff += Math.abs(noteCountDiff);
  durationDiff += Math.abs(noteCountDiff);
  velocityDiff += Math.abs(noteCountDiff);

  const ccDiff = Math.abs(current.cc64.length - golden.cc64.length)
    + current.cc64.reduce((acc, c, i) => {
      const g = golden.cc64[i];
      if (!g) return acc + 1;
      return acc + (c.tick !== g.tick || c.value !== g.value ? 1 : 0);
    }, 0);

  if (pitchDiff) failures.push({ category: 'regression', code: 'pitch_diff', message: `${pitchDiff} pitch event(s)` });
  if (onsetDiff) failures.push({ category: 'regression', code: 'onset_diff', message: `${onsetDiff} onset event(s)` });
  if (durationDiff) {
    failures.push({ category: 'regression', code: 'duration_diff', message: `${durationDiff} duration event(s)` });
  }
  if (velocityDiff) {
    failures.push({ category: 'regression', code: 'velocity_diff', message: `${velocityDiff} velocity event(s)` });
  }
  if (ccDiff) failures.push({ category: 'regression', code: 'cc_diff', message: `${ccDiff} CC event(s)` });

  return {
    caseId,
    present: true,
    pass: failures.length === 0,
    pitchDiff,
    onsetDiff,
    durationDiff,
    velocityDiff,
    ccDiff,
    noteCountDiff,
    failures,
  };
}
