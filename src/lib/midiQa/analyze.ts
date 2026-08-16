/**
 * Read a production Final MIDI snapshot + plan into QA analysis records.
 * Does not generate notes — the caller must use buildFinalMidiSnapshot.
 */

import { resolveAllowed } from '@/lib/performance/strictV2';
import type { FinalMidiNote, FinalMidiSnapshot, SessionPerformancePlan } from '@/lib/midiExport';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';

import type { QaProgressionId } from './progressions';
import type { AttackGroup, BarAnalysis, CaseAnalysis } from './types';

const ONSET_EPS = 1 / 32;

export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

export function allowedPcsFor(chord: PerfChord): number[] {
  if (chord.harmony) return [...resolveAllowed(chord.harmony).pcs];
  return [...new Set(chord.bodyMidi.map(pitchClass))].sort((a, b) => a - b);
}

export function degreeForPc(pc: number, rootPc: number, intervals: readonly number[]): string {
  const iv = ((pc - rootPc) % 12 + 12) % 12;
  const normalizedIntervals = new Set(intervals.map((interval) => ((interval % 12) + 12) % 12));
  if (iv === 0) return 'root';
  if (normalizedIntervals.has(3) && iv === 3) return 'third';
  if (normalizedIntervals.has(4) && iv === 4) return 'third';
  if (normalizedIntervals.has(6) && iv === 6) return 'fifth';
  if (normalizedIntervals.has(7) && iv === 7) return 'fifth';
  if (normalizedIntervals.has(8) && iv === 8) return 'fifth';
  if (normalizedIntervals.has(10) && iv === 10) return 'seventh';
  if (normalizedIntervals.has(11) && iv === 11) return 'seventh';
  if (normalizedIntervals.has(1) && iv === 1) return 'ninth';
  if (normalizedIntervals.has(2) && iv === 2) return 'ninth';
  if (iv === 3 || iv === 4) return 'third';
  if (iv === 7) return 'fifth';
  return 'other';
}

export function accompanimentNotes(snapshot: FinalMidiSnapshot): FinalMidiNote[] {
  return snapshot.notes.filter((n) => n.track === 'accompaniment');
}

export function clusterAttackGroups(notes: readonly FinalMidiNote[]): AttackGroup[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const groups: AttackGroup[] = [];
  for (const n of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(n.startBeat - last.startBeat) <= ONSET_EPS) {
      last.pitches.push(n.pitch);
      last.velocities.push(n.velocity);
      last.durations.push(n.durationBeat);
    } else {
      groups.push({
        startBeat: n.startBeat,
        pitches: [n.pitch],
        velocities: [n.velocity],
        durations: [n.durationBeat],
      });
    }
  }
  return groups;
}

function notesInWindow(
  notes: readonly FinalMidiNote[],
  start: number,
  end: number,
): FinalMidiNote[] {
  return notes.filter((n) => n.startBeat >= start - 1e-6 && n.startBeat < end - 1e-6);
}

export function analyzeBars(
  snapshot: FinalMidiSnapshot,
  plan: SessionPerformancePlan,
): BarAnalysis[] {
  const notes = accompanimentNotes(snapshot);
  return plan.chords.map((chord, i) => {
    const start = chord.startBeat;
    const end = chord.startBeat + chord.durationBeats;
    const inBar = notesInWindow(notes, start, end);
    const groups = clusterAttackGroups(inBar);
    const allowed = allowedPcsFor(chord);
    const illegal = inBar.filter((n) => !allowed.includes(pitchClass(n.pitch))).map((n) => n.pitch);
    const usedPcs = new Set(inBar.map((n) => pitchClass(n.pitch)));
    const missing: string[] = [];
    if (chord.harmony) {
      const root = chord.harmony.rootPc;
      if (!usedPcs.has(root)) missing.push('root');
      const thirdIv = chord.harmony.chordIntervals.find((iv) => iv === 3 || iv === 4);
      if (thirdIv !== undefined && !usedPcs.has((root + thirdIv) % 12)) missing.push('third');
    }
    const seen = new Map<string, number>();
    const duplicates: number[] = [];
    for (const n of inBar) {
      const key = `${n.startBeat.toFixed(4)}:${n.pitch}`;
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count === 2) duplicates.push(n.pitch);
    }
    const degreeCounts: Record<string, number> = {};
    const intervals = chord.harmony?.chordIntervals ?? [];
    const rootPc = chord.harmony?.rootPc ?? 0;
    for (const n of inBar) {
      const deg = degreeForPc(pitchClass(n.pitch), rootPc, intervals);
      degreeCounts[deg] = (degreeCounts[deg] ?? 0) + 1;
    }
    return {
      chordLabel: plan.progression[i]?.displayName ?? `#${i}`,
      startBeat: start,
      durationBeats: chord.durationBeats,
      allowedPcs: allowed,
      noteCount: inBar.length,
      attackGroupCount: groups.length,
      attackGroups: groups,
      illegalPitches: illegal,
      missingEssentials: missing,
      duplicatePitches: duplicates,
      degreeCounts,
    };
  });
}

export function analyzeCase(
  caseId: string,
  pattern: CaseAnalysis['pattern'],
  variantId: string,
  progressionId: QaProgressionId,
  snapshot: FinalMidiSnapshot,
  plan: SessionPerformancePlan,
): CaseAnalysis {
  const notes = accompanimentNotes(snapshot);
  const pitches = notes.map((n) => n.pitch);
  const pitchMin = pitches.length ? Math.min(...pitches) : 0;
  const pitchMax = pitches.length ? Math.max(...pitches) : 0;
  return {
    caseId,
    pattern,
    variantId,
    progressionId,
    humanTemplateId: plan.humanTemplateId,
    noteCount: notes.length,
    cc64Count: snapshot.controlChanges.filter((c) => c.controller === 64).length,
    pitchMin,
    pitchMax,
    registerSpan: pitchMax - pitchMin,
    bars: analyzeBars(snapshot, plan),
    failures: [],
  };
}
