/**
 * POP909-CL chord-track decode — same rules as their process_pop909.py:
 * notes sharing an onset form a pitch-class set; quality is an exact interval
 * match; bass is the lowest MIDI pitch class.
 */

import type { PopChordQuality, PopChordSpan } from './types';

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

type QualityRule = { quality: PopChordQuality; degrees: readonly number[] };

const QUALITY_RULES: readonly QualityRule[] = [
  { quality: 'maj9', degrees: [0, 2, 4, 7, 11] },
  { quality: '9', degrees: [0, 2, 4, 7, 10] },
  { quality: 'm9', degrees: [0, 2, 3, 7, 10] },
  { quality: 'add9', degrees: [0, 2, 4, 7] },
  { quality: '7', degrees: [0, 4, 7, 10] },
  { quality: 'maj7', degrees: [0, 4, 7, 11] },
  { quality: 'm7', degrees: [0, 3, 7, 10] },
  { quality: 'hdim7', degrees: [0, 3, 6, 10] },
  { quality: 'dim7', degrees: [0, 3, 6, 9] },
  { quality: 'mM7', degrees: [0, 3, 7, 11] },
  { quality: 'aug7', degrees: [0, 4, 8, 10] },
  { quality: 'major', degrees: [0, 4, 7] },
  { quality: 'minor', degrees: [0, 3, 7] },
  { quality: 'dim', degrees: [0, 3, 6] },
  { quality: 'aug', degrees: [0, 4, 8] },
  { quality: 'sus2', degrees: [0, 2, 7] },
  { quality: 'sus4', degrees: [0, 5, 7] },
];

const QUALITY_INTERVALS: Record<Exclude<PopChordQuality, 'N' | 'other'>, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  hdim7: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  mM7: [0, 3, 7, 11],
  aug7: [0, 4, 8, 10],
  add9: [0, 2, 4, 7],
  '9': [0, 2, 4, 7, 10],
  maj9: [0, 2, 4, 7, 11],
  m9: [0, 2, 3, 7, 10],
};

export function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function pcName(pc: number): string {
  return PC_NAMES[wrapPc(pc)];
}

function sameSet(a: ReadonlySet<number>, b: readonly number[]): boolean {
  if (a.size !== b.length) return false;
  return b.every((x) => a.has(x));
}

export function identifyQuality(
  pitchClasses: readonly number[],
): { rootPc: number; quality: PopChordQuality } {
  const pcs = [...new Set(pitchClasses.map(wrapPc))];
  if (pcs.length === 0) return { rootPc: 0, quality: 'N' };
  for (const root of pcs) {
    const degrees = new Set(pcs.map((p) => wrapPc(p - root)));
    for (const rule of QUALITY_RULES) {
      if (sameSet(degrees, rule.degrees)) return { rootPc: root, quality: rule.quality };
    }
  }
  return { rootPc: pcs[0], quality: 'other' };
}

export function intervalsForQuality(quality: PopChordQuality, rootPc: number): number[] {
  if (quality === 'N') return [];
  if (quality === 'other') return [0];
  return [...QUALITY_INTERVALS[quality]].map((iv) => wrapPc(rootPc + iv));
}

export function degreeLabel(pc: number, rootPc: number): string {
  const iv = wrapPc(pc - rootPc);
  switch (iv) {
    case 0:
      return '1';
    case 1:
      return 'b9';
    case 2:
      return '9';
    case 3:
      return 'b3';
    case 4:
      return '3';
    case 5:
      return '11';
    case 6:
      return '#11';
    case 7:
      return '5';
    case 8:
      return 'b13';
    case 9:
      return '13';
    case 10:
      return 'b7';
    case 11:
      return '7';
    default:
      return String(iv);
  }
}

export function inversionOf(bassDegree: string): 'root' | 'first' | 'second' | 'other' {
  if (bassDegree === '1') return 'root';
  if (bassDegree === '3' || bassDegree === 'b3') return 'first';
  if (bassDegree === '5') return 'second';
  return 'other';
}

export type ChordNote = { tick: number; pitch: number; durTicks: number };

/**
 * Group chord-track notes by onset tick and emit spans until the next group.
 */
export function spansFromChordNotes(
  notes: readonly ChordNote[],
  ppq: number,
  songEndTick: number,
): PopChordSpan[] {
  const byTick = new Map<number, ChordNote[]>();
  for (const n of notes) {
    const list = byTick.get(n.tick) ?? [];
    list.push(n);
    byTick.set(n.tick, list);
  }
  const onsets = [...byTick.keys()].sort((a, b) => a - b);
  const spans: PopChordSpan[] = [];
  for (let i = 0; i < onsets.length; i += 1) {
    const start = onsets[i];
    const group = byTick.get(start) ?? [];
    const end = i + 1 < onsets.length ? onsets[i + 1] : Math.max(songEndTick, start + ppq);
    const pcs = group.map((n) => wrapPc(n.pitch));
    const bassPc = wrapPc(Math.min(...group.map((n) => n.pitch)));
    const { rootPc, quality } = identifyQuality(pcs);
    if (quality === 'N') continue;
    spans.push({
      startBeat: start / ppq,
      endBeat: end / ppq,
      rootPc,
      bassPc,
      quality,
      symbol: `${pcName(rootPc)}:${quality}${bassPc !== rootPc ? `/${pcName(bassPc)}` : ''}`,
    });
  }
  return spans.filter((s) => s.endBeat - s.startBeat > 1e-6);
}
