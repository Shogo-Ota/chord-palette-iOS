/**
 * Transpose invariance: progression A (C|Am|F|G) vs B (D|Bm|G|A) must be +2.
 */

import type { FinalMidiControlChange, FinalMidiNote, FinalMidiSnapshot } from '@/lib/midiExport';

import { accompanimentNotes } from './analyze';
import type { QaFailure, TransposePairResult } from './types';
import type { AccompanimentPattern } from '@/types';

const ONSET_EPS = 1e-3;
const DUR_EPS = 1e-3;
const EXPECTED_SHIFT = 2;

function sortNotes(notes: readonly FinalMidiNote[]): FinalMidiNote[] {
  return [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

function sortCc(ccs: readonly FinalMidiControlChange[]): FinalMidiControlChange[] {
  return [...ccs]
    .filter((c) => c.controller === 64)
    .sort((a, b) => a.startBeat - b.startBeat || a.value - b.value);
}

export function compareTranspose(
  pattern: AccompanimentPattern,
  variantId: string,
  fromA: FinalMidiSnapshot,
  fromB: FinalMidiSnapshot,
): TransposePairResult {
  const a = sortNotes(accompanimentNotes(fromA));
  const b = sortNotes(accompanimentNotes(fromB));
  const failures: QaFailure[] = [];
  const applicable = a.length > 0 && b.length > 0;

  if (a.length !== b.length) {
    failures.push({
      category: 'transpose',
      code: 'note_count',
      message: `A has ${a.length} notes, B has ${b.length}`,
    });
  }

  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (Math.abs(left.startBeat - right.startBeat) > ONSET_EPS) {
      failures.push({
        category: 'transpose',
        code: 'onset',
        message: `onset ${left.startBeat} vs ${right.startBeat} at index ${i}`,
        beat: left.startBeat,
      });
    }
    if (Math.abs(left.durationBeat - right.durationBeat) > DUR_EPS) {
      failures.push({
        category: 'transpose',
        code: 'duration',
        message: `duration ${left.durationBeat} vs ${right.durationBeat} at index ${i}`,
        beat: left.startBeat,
      });
    }
    if (left.velocity !== right.velocity) {
      failures.push({
        category: 'transpose',
        code: 'velocity',
        message: `velocity ${left.velocity} vs ${right.velocity} at index ${i}`,
        beat: left.startBeat,
      });
    }
    if (right.pitch - left.pitch !== EXPECTED_SHIFT) {
      failures.push({
        category: 'transpose',
        code: 'pitch_shift',
        message: `pitch ${left.pitch} → ${right.pitch} (expected +${EXPECTED_SHIFT}) at index ${i}`,
        beat: left.startBeat,
        pitch: left.pitch,
      });
    }
  }

  const ccA = sortCc(fromA.controlChanges);
  const ccB = sortCc(fromB.controlChanges);
  if (ccA.length !== ccB.length) {
    failures.push({
      category: 'transpose',
      code: 'cc64_count',
      message: `CC64 count ${ccA.length} vs ${ccB.length}`,
    });
  }
  const ccN = Math.min(ccA.length, ccB.length);
  for (let i = 0; i < ccN; i++) {
    if (Math.abs(ccA[i]!.startBeat - ccB[i]!.startBeat) > ONSET_EPS || ccA[i]!.value !== ccB[i]!.value) {
      failures.push({
        category: 'transpose',
        code: 'cc64',
        message: `CC64 ${ccA[i]!.startBeat}/${ccA[i]!.value} vs ${ccB[i]!.startBeat}/${ccB[i]!.value}`,
      });
    }
  }

  return {
    pattern,
    variantId,
    applicable,
    pass: applicable && failures.length === 0,
    failures,
  };
}
