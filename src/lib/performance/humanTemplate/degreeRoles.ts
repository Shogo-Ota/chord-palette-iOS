/**
 * User-chord degrees for Voice Structure realization.
 * A degree is not only a pitch class — color tones carry Upper/Top affinity.
 */

export const HARMONIC_DEGREES = [
  'root',
  'third',
  'fifth',
  'seventh',
  'ninth',
  'eleventh',
  'thirteenth',
] as const;

export type HarmonicDegree = (typeof HARMONIC_DEGREES)[number];

export type DegreeKind = 'essential' | 'support' | 'color';

export type DegreeInfo = {
  degree: HarmonicDegree;
  pc: number;
  kind: DegreeKind;
  /** Soft: prefer UPPER / TOP. Not a hard TOP rule. */
  upperTopAffinity: boolean;
};

export function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function classifyInterval(interval: number): HarmonicDegree {
  if (interval === 14 || interval === 13) return 'ninth';
  if (interval === 17) return 'eleventh';
  if (interval === 21) return 'thirteenth';
  const n = wrapPc(interval);
  if (n === 0) return 'root';
  if (n === 3 || n === 4) return 'third';
  if (n === 6 || n === 7 || n === 8) return 'fifth';
  if (n === 10 || n === 11) return 'seventh';
  if (n === 1 || n === 2) return 'ninth';
  if (n === 5) return 'eleventh';
  return 'thirteenth';
}

export function kindOfDegree(degree: HarmonicDegree): DegreeKind {
  if (degree === 'root' || degree === 'third') return 'essential';
  if (degree === 'fifth') return 'support';
  return 'color';
}

export function degreesFromIntervals(rootPc: number, intervals: readonly number[]): DegreeInfo[] {
  const root = wrapPc(rootPc);
  const seen = new Set<number>();
  const out: DegreeInfo[] = [];
  for (const iv of intervals) {
    const pc = wrapPc(root + iv);
    if (seen.has(pc)) continue;
    seen.add(pc);
    const degree = classifyInterval(iv);
    const kind = kindOfDegree(degree);
    out.push({
      degree,
      pc,
      kind,
      upperTopAffinity: kind === 'color',
    });
  }
  return out;
}

export function degreeOfPc(pc: number, degrees: readonly DegreeInfo[]): DegreeInfo | undefined {
  return degrees.find((d) => d.pc === wrapPc(pc));
}

export function bassCandidatePcs(
  degrees: readonly DegreeInfo[],
  slashBassPc: number | undefined,
): number[] {
  if (slashBassPc != null) return [wrapPc(slashBassPc)];
  const pcs = degrees
    .filter((d) => d.degree === 'root' || d.degree === 'third' || d.degree === 'fifth')
    .map((d) => d.pc);
  return pcs.length ? pcs : degrees.map((d) => d.pc);
}

export function colorPcs(degrees: readonly DegreeInfo[]): number[] {
  return degrees.filter((d) => d.upperTopAffinity).map((d) => d.pc);
}

export function bodyPcs(degrees: readonly DegreeInfo[]): number[] {
  return degrees.filter((d) => !d.upperTopAffinity).map((d) => d.pc);
}
