/**
 * Phase 3C Device Listening / fidelity cases.
 *
 * Same sessions as Phase 3A. Generation is not redefined here — these are
 * the inputs the playback layer is judged against. Domain only.
 */

import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { ChordEvent, MajorKey } from '@/types';

export type Phase3cCaseId = 'natural-type1' | 'variation-type1';

export type Phase3cCase = {
  id: Phase3cCaseId;
  label: string;
  key: MajorKey;
  session: PerformanceSessionInput;
};

function ev(rootOffset: number, suffix: string, displayName: string): ChordEvent {
  return {
    id: `p3c-${displayName}`,
    chordId: `p3c-${displayName}`,
    rootOffset,
    suffix,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
  };
}

const I_VI_IV_V: ReadonlyArray<readonly [number, string]> = [
  [0, ''],
  [9, 'm'],
  [5, ''],
  [7, ''],
];

function prog(names: readonly [string, string, string, string]): ChordEvent[] {
  return I_VI_IV_V.map(([off, suf], i) => ev(off, suf, names[i]!));
}

function session(
  key: MajorKey,
  names: readonly [string, string, string, string],
  pattern: 'natural' | 'arpeggio',
  variant: 'natural.type1' | 'arpeggio.type1',
): PerformanceSessionInput {
  return {
    key,
    tempoBpm: 70,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: variant,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: true,
    instrumentEffect: 'off',
    drumMode: 'off',
    drumBeat: '8',
    progression: prog(names),
  };
}

export const PHASE3C_CASES: Record<Phase3cCaseId, Phase3cCase> = {
  'natural-type1': {
    id: 'natural-type1',
    label: 'Natural Type1 · C | Am | F | G',
    key: 'C',
    session: session('C', ['C', 'Am', 'F', 'G'], 'natural', 'natural.type1'),
  },
  'variation-type1': {
    id: 'variation-type1',
    label: 'Variation Type1 · D | Bm | G | A',
    key: 'D',
    session: session('D', ['D', 'Bm', 'G', 'A'], 'arpeggio', 'arpeggio.type1'),
  },
};

export const PHASE3C_CASE_IDS: readonly Phase3cCaseId[] = [
  'natural-type1',
  'variation-type1',
];
