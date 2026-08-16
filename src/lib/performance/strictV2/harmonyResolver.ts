/** Harmony Resolver — chord symbol → AllowedToneSet (hard constraint). */

export interface ChordHarmonyInput {
  symbol: string;
  rootPc: number;
  quality: string;
  chordIntervals: readonly number[];
  /** Slash / on-chord bass (0–11). Absent = inversion is free. */
  slashBassPc?: number;
}

export interface AllowedToneSet {
  readonly symbol: string;
  readonly rootPc: number;
  readonly quality: string;
  readonly intervals: readonly number[];
  readonly pcs: readonly number[];
  containsPitch(pitch: number): boolean;
  containsPc(pc: number): boolean;
}

export interface ClarityPriorityPcs {
  root: readonly number[];
  third: readonly number[];
  seventh: readonly number[];
  tensions: readonly number[];
  fifth: readonly number[];
}

export function resolveAllowed(chord: ChordHarmonyInput): AllowedToneSet {
  const root = chord.rootPc % 12;
  const intervals = chord.chordIntervals.map((x) => x | 0);
  const pcs = [...new Set(intervals.map((iv) => (root + iv) % 12))].sort((a, b) => a - b);
  return {
    symbol: chord.symbol,
    rootPc: root,
    quality: chord.quality,
    intervals,
    pcs,
    containsPitch(pitch: number): boolean {
      return pcs.includes(((pitch % 12) + 12) % 12);
    },
    containsPc(pc: number): boolean {
      return pcs.includes(((pc % 12) + 12) % 12);
    },
  };
}

/** Soft hints for Voicing Optimizer chordClarity (not hard constraints). */
export function clarityPriorityPcs(allowed: AllowedToneSet): ClarityPriorityPcs {
  const root = allowed.rootPc;
  let third: number | undefined;
  let seventh: number | undefined;
  const tensions: number[] = [];
  for (const iv of allowed.intervals) {
    const pc = (root + iv) % 12;
    if (iv === 3 || iv === 4) third = pc;
    else if (iv === 10 || iv === 11) seventh = pc;
    else if (iv === 2 || iv === 5 || iv === 9) tensions.push(pc);
  }
  return {
    root: [root],
    third: third !== undefined ? [third] : [],
    seventh: seventh !== undefined ? [seventh] : [],
    tensions,
    fifth: allowed.intervals.includes(7) ? [(root + 7) % 12] : [],
  };
}
