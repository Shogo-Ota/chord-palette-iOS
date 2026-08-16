/** Voicing Optimizer — attack-unit pitch assignment under AllowedToneSet. */

import {
  clarityPriorityPcs,
  type AllowedToneSet,
} from './harmonyResolver';
import {
  HARD_RANGE,
  foldPcToWindow,
  registerCost,
  voiceRegisterFor,
} from './registerPolicy';

export interface TemplateNote {
  chordRole?: string;
  /** Production degree. Preferred over `chordRole` at realize time. */
  degree?: 'root' | 'third' | 'fifth' | 'seventh' | 'ninth';
  /** Semitone offset vs the spelled degree. Compiled from source MIDI. */
  alteration?: number;
  voiceRole?: 'bass' | 'inner' | 'upper' | 'top';
  /** Octaves above the chord root: pitch = rootPc + degreeInterval + 12 * relativeOctave. */
  relativeOctave?: number;
  /** CHORD_TONE vs teacher ornament. Chromatic notes are never relabeled as extensions. */
  toneKind?: 'chordTone' | 'chromatic';
  /** Lossless: teacherPitch = sourceRootPc + intervalFromRoot. Runtime uses this. */
  intervalFromRoot?: number;
  /** Teacher chord root (0–11). Compile-time only; pairs with intervalFromRoot. */
  sourceRootPc?: number;
  /** Nearest GT chord degree for a chromatic ornament. */
  anchorDegree?: 'root' | 'third' | 'fifth' | 'seventh' | 'ninth';
  /** Semitone offset from the anchor degree's spelled pitch class. */
  chromaticOffsetSemitones?: number;
  attackGroup?: number;
  voicingPosition?: string;
  octaveRelation?: number;
  registerHint?: string;
  /** Source-MIDI ingest only. Runtime pitch selection must not read this. */
  absolutePitch?: number;
  velocity?: number;
  relativeVelocity?: number;
  durationBeats?: number;
  gate?: number;
}

export interface ScoreBreakdown {
  voiceLeading: number;
  registerBalance: number;
  chordClarity: number;
  templateSimilarity: number;
  largeLeap: number;
  muddyLowInterval: number;
  voiceCrossing: number;
  excessiveRootDoubling: number;
  total: number;
}

export interface VoicingState {
  prevPitches: number[] | null;
  prevBass: number | null;
  prevTop: number | null;
  prevChordPcs: readonly number[] | null;
}

export interface VoicingResult {
  pitches: number[];
  score: ScoreBreakdown;
  omittedPcs: number[];
  doubledPcs: number[];
}

export function emptyVoicingState(): VoicingState {
  return { prevPitches: null, prevBass: null, prevTop: null, prevChordPcs: null };
}

function preferredCenter(note: TemplateNote, allowed: AllowedToneSet): number {
  const rolePc = pcForRole(note.chordRole ?? 'root', allowed);
  const zone = voiceRegisterFor(note).preferred;
  // octaveRelation is a small nudge inside the zone, not a free octave jump.
  const nudged = {
    lo: zone.lo,
    hi: zone.hi,
    center: Math.max(zone.lo, Math.min(zone.hi, zone.center + (note.octaveRelation ?? 0) * 2)),
  };
  return foldPcToWindow(rolePc, nudged);
}

function voiceRank(note: TemplateNote): number {
  const role = note.voiceRole ?? note.voicingPosition ?? '';
  if (role === 'bass' || role === 'lowest') return 0;
  if (role === 'inner') return 1;
  if (role === 'upper') return 2;
  if (role === 'top') return 3;
  return 1;
}

function roleTargetPitch(note: TemplateNote, allowed: AllowedToneSet): number {
  return preferredCenter(note, allowed);
}

function pcForRole(role: string, allowed: AllowedToneSet): number {
  const pri = clarityPriorityPcs(allowed);
  switch (role) {
    case 'root':
      return allowed.rootPc;
    case 'third':
      return pri.third[0] ?? allowed.rootPc;
    case 'fifth':
      return pri.fifth[0] ?? (allowed.rootPc + 7) % 12;
    case 'seventh':
      return pri.seventh[0] ?? pri.third[0] ?? allowed.rootPc;
    case 'ninth':
    case 'eleventh':
    case 'thirteenth':
      return pri.tensions[0] ?? pri.seventh[0] ?? pri.third[0] ?? allowed.rootPc;
    default:
      return allowed.rootPc;
  }
}

function poolForAttack(
  notes: readonly TemplateNote[],
  allowed: AllowedToneSet,
  lo = HARD_RANGE.lo,
  hi = HARD_RANGE.hi,
): number[] {
  const centers = notes.map((n) => preferredCenter(n, allowed));
  const cmin = Math.min(...centers);
  const cmax = Math.max(...centers);
  let pool: number[] = [];
  for (let p = Math.max(lo, cmin - 16); p <= Math.min(hi, cmax + 16); p++) {
    if (allowed.containsPitch(p)) pool.push(p);
  }
  if (pool.length < notes.length) {
    pool = [];
    for (let p = lo; p <= hi; p++) {
      if (allowed.containsPitch(p)) pool.push(p);
    }
  }
  if (pool.length > 18) {
    pool = [...pool]
      .sort(
        (a, b) =>
          Math.min(...centers.map((c) => Math.abs(a - c))) -
          Math.min(...centers.map((c) => Math.abs(b - c))),
      )
      .slice(0, 18)
      .sort((a, b) => a - b);
  }
  return pool;
}

function assignOrderPreserving(
  notes: readonly TemplateNote[],
  pitchesSorted: readonly number[],
): number[] {
  const indexed = notes.map((n, i) => [i, n] as const);
  indexed.sort((a, b) => {
    const ao = a[1].relativeOctave ?? voiceRank(a[1]);
    const bo = b[1].relativeOctave ?? voiceRank(b[1]);
    if (ao !== bo) return ao - bo;
    return voiceRank(a[1]) - voiceRank(b[1]) || a[0] - b[0];
  });
  const out = new Array<number>(notes.length).fill(0);
  indexed.forEach(([origI], idx) => {
    out[origI] = pitchesSorted[idx] ?? pitchesSorted[pitchesSorted.length - 1] ?? 60;
  });
  return out;
}

function nearestSeed(notes: readonly TemplateNote[], allowed: AllowedToneSet): number[] {
  const lo = HARD_RANGE.lo;
  const hi = HARD_RANGE.hi;
  const pool = Array.from({ length: hi - lo + 1 }, (_, i) => i + lo).filter((p) =>
    allowed.containsPitch(p),
  );
  const occupied: number[] = [];
  const out: number[] = [];
  for (const n of notes) {
    const target = roleTargetPitch(n, allowed);
    const cands = [...pool].sort((a, b) => {
      const aOcc = occupied.includes(a) ? 1 : 0;
      const bOcc = occupied.includes(b) ? 1 : 0;
      if (aOcc !== bOcc) return aOcc - bOcc;
      const da = Math.abs(a - target);
      const db = Math.abs(b - target);
      if (da !== db) return da - db;
      return Math.abs(a - preferredCenter(n, allowed)) - Math.abs(b - preferredCenter(n, allowed));
    });
    const pick = cands[0] ?? target;
    out.push(pick);
    occupied.push(pick);
  }
  return out;
}

function claritySeed(notes: readonly TemplateNote[], allowed: AllowedToneSet): number[] | null {
  const n = notes.length;
  if (n === 0) return null;
  const pri = clarityPriorityPcs(allowed);
  const want: number[] = [];
  if (pri.root.length) want.push(pri.root[0]!);
  if (pri.fifth.length) want.push(pri.fifth[0]!);
  if (pri.third.length) want.push(pri.third[0]!);
  if (pri.seventh.length) want.push(pri.seventh[0]!);
  for (const t of pri.tensions) want.push(t);
  const pcs: number[] = [];
  for (const pc of want) {
    if (!pcs.includes(pc)) pcs.push(pc);
  }
  if (!pcs.length) pcs.push(...allowed.pcs);
  const lowNote = notes.reduce((a, b) =>
    (a.relativeOctave ?? voiceRank(a)) <= (b.relativeOctave ?? voiceRank(b)) ? a : b,
  );
  const bassCenter = preferredCenter(lowNote, allowed);
  const bassPc = pcs[0]!;
  let bass = 60;
  let bestDist = Infinity;
  for (let p = HARD_RANGE.lo; p <= HARD_RANGE.hi; p++) {
    if (p % 12 !== bassPc) continue;
    const d = Math.abs(p - bassCenter);
    if (d < bestDist) {
      bestDist = d;
      bass = p;
    }
  }
  const stack = [bass];
  for (const pc of pcs.slice(1)) {
    let cand = pc;
    while (cand <= stack[stack.length - 1]!) cand += 12;
    if (cand > HARD_RANGE.hi) cand -= 12;
    stack.push(cand);
  }
  while (stack.length < n) {
    stack.push(Math.min(HARD_RANGE.hi, stack[stack.length - 1]! + 12));
  }
  return assignOrderPreserving(notes, [...stack.slice(0, n)].sort((a, b) => a - b));
}

function combinations(pool: readonly number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (pool.length < k) return [];
  const [first, ...rest] = pool;
  const withFirst = combinations(rest, k).map((c) => [first!, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function generateCandidates(notes: readonly TemplateNote[], allowed: AllowedToneSet): number[][] {
  const n = notes.length;
  if (n === 0) return [];
  if (n === 1) {
    const center = roleTargetPitch(notes[0]!, allowed);
    const span = HARD_RANGE.hi - HARD_RANGE.lo + 1;
    let cands = Array.from({ length: span }, (_, i) => i + HARD_RANGE.lo).filter(
      (p) => allowed.containsPitch(p) && Math.abs(p - center) <= 18,
    );
    if (!cands.length) {
      cands = Array.from({ length: span }, (_, i) => i + HARD_RANGE.lo).filter((p) =>
        allowed.containsPitch(p),
      );
    }
    cands.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    return cands.slice(0, 24).map((p) => [p]);
  }

  let pool = poolForAttack(notes, allowed);
  if (pool.length < n) {
    pool = Array.from({ length: HARD_RANGE.hi - HARD_RANGE.lo + 1 }, (_, i) => i + HARD_RANGE.lo).filter(
      (p) => allowed.containsPitch(p),
    );
  }

  const combos: number[][] = [];
  const maxCombos = 800;
  for (const combo of combinations(pool, n)) {
    combos.push(assignOrderPreserving(notes, [...combo].sort((a, b) => a - b)));
    if (combos.length >= maxCombos) break;
  }

  const seeds = [nearestSeed(notes, allowed)];
  const clarity = claritySeed(notes, allowed);
  if (clarity) seeds.push(clarity);
  for (const s of seeds) {
    if (s.every((p) => allowed.containsPitch(p))) {
      const key = s.join(',');
      if (!combos.some((c) => c.join(',') === key)) combos.push(s);
    }
  }
  return combos;
}

export function scoreVoicing(
  pitches: readonly number[],
  notes: readonly TemplateNote[],
  allowed: AllowedToneSet,
  state: VoicingState,
): ScoreBreakdown {
  const sb: ScoreBreakdown = {
    voiceLeading: 0,
    registerBalance: 0,
    chordClarity: 0,
    templateSimilarity: 0,
    largeLeap: 0,
    muddyLowInterval: 0,
    voiceCrossing: 0,
    excessiveRootDoubling: 0,
    total: 0,
  };
  const n = pitches.length;
  if (n === 0) return sb;

  const centers = notes.map((note) => preferredCenter(note, allowed));
  const tpl = centers;

  if (state.prevPitches) {
    const prev = state.prevPitches;
    const prevSet = new Set(prev.map((p) => p % 12));
    let commonCount = 0;
    for (const pc of pitches.map((p) => p % 12)) {
      if (prevSet.has(pc)) commonCount++;
    }
    const a = [...pitches].sort((x, y) => x - y);
    const b = [...prev].sort((x, y) => x - y);
    const m = Math.min(a.length, b.length);
    let move = 0;
    let leaps = 0;
    for (let i = 0; i < m; i++) {
      move += Math.abs(a[i]! - b[i]!);
      if (Math.abs(a[i]! - b[i]!) > 12) leaps++;
    }
    sb.voiceLeading = commonCount * 2 + Math.max(0, 12 - move / Math.max(1, m));
    sb.largeLeap = leaps;
  } else {
    sb.voiceLeading = 6;
  }

  sb.registerBalance =
    pitches.reduce((sum, p, i) => sum + Math.max(0, 12 - Math.abs(p - centers[i]!)), 0) / n -
    pitches.reduce((sum, p, i) => sum + registerCost(p, notes[i]!), 0);

  const pri = clarityPriorityPcs(allowed);
  const pcsUsed = pitches.map((p) => p % 12);
  let clarity = 0;
  if (pri.third.length && pcsUsed.includes(pri.third[0]!)) clarity += 4;
  else if (n >= 2 && pri.third.length) clarity -= 2;
  if (pri.seventh.length) {
    if (pcsUsed.includes(pri.seventh[0]!)) clarity += 4;
    else if (n >= 3) clarity -= 1;
  }
  const bassPc = Math.min(...pitches) % 12;
  for (const t of pri.tensions) {
    if (pcsUsed.includes(t)) {
      clarity += 1.5;
      if (bassPc === t) clarity -= 3;
    }
  }
  sb.chordClarity = clarity;

  const ts = [...tpl].sort((a, b) => a - b);
  const ps = [...pitches].sort((a, b) => a - b);
  if (n >= 2) {
    const tInt = ts.map((t) => t - ts[0]!);
    const pInt = ps.map((p) => p - ps[0]!);
    const shape =
      tInt.reduce((sum, t, i) => sum + Math.max(0, 8 - Math.abs(t - pInt[i]!)), 0) / n;
    const prox = ps.reduce((sum, p, i) => sum + Math.max(0, 12 - Math.abs(p - ts[i]!)), 0) / n;
    sb.templateSimilarity = 0.6 * shape + 0.4 * prox;
  } else {
    sb.templateSimilarity = Math.max(0, 12 - Math.abs(pitches[0]! - tpl[0]!));
  }

  const sp = [...pitches].sort((a, b) => a - b);
  let muddy = 0;
  for (let i = 0; i < sp.length - 1; i++) {
    if (sp[i]! < 55 && sp[i + 1]! < 55 && sp[i + 1]! - sp[i]! <= 2 && sp[i + 1]! !== sp[i]!) {
      muddy++;
    }
  }
  sb.muddyLowInterval = muddy;

  const tplOrder = [...notes.keys()].sort((i, j) => tpl[i]! - tpl[j]!);
  const pitchOrder = [...notes.keys()].sort((i, j) => pitches[i]! - pitches[j]!);
  sb.voiceCrossing =
    tplOrder.every((v, idx) => v === pitchOrder[idx]) ? 0 : 2;

  const rootCount = pitches.filter((p) => p % 12 === allowed.rootPc).length;
  const limit = Math.max(1, Math.floor(n / 2));
  sb.excessiveRootDoubling = Math.max(0, rootCount - limit);

  sb.total =
    3 * sb.voiceLeading +
    2 * sb.registerBalance +
    2.5 * sb.chordClarity +
    2 * sb.templateSimilarity -
    2 * sb.largeLeap -
    3 * sb.muddyLowInterval -
    4 * sb.voiceCrossing -
    1.5 * sb.excessiveRootDoubling;

  return sb;
}

export function optimizeAttack(
  notes: readonly TemplateNote[],
  allowed: AllowedToneSet,
  state: VoicingState,
): VoicingResult {
  const cands = generateCandidates(notes, allowed);
  let bestPitches: number[] | null = null;
  let bestScore: ScoreBreakdown = { ...emptyScore(), total: -1e9 };

  for (const pitches of cands) {
    if (pitches.some((p) => !allowed.containsPitch(p))) continue;
    const sc = scoreVoicing(pitches, notes, allowed, state);
    if (sc.total > bestScore.total) {
      bestScore = sc;
      bestPitches = [...pitches];
    }
  }

  if (!bestPitches) {
    bestPitches = nearestSeed(notes, allowed);
    bestScore = scoreVoicing(bestPitches, notes, allowed, state);
  }

  const used = new Set(bestPitches.map((p) => p % 12));
  const omitted = allowed.pcs.filter((pc) => !used.has(pc));
  const counts = new Map<number, number>();
  for (const p of bestPitches) {
    const pc = p % 12;
    counts.set(pc, (counts.get(pc) ?? 0) + 1);
  }
  const doubled = [...counts.entries()].filter(([, c]) => c > 1).map(([pc]) => pc);

  return { pitches: bestPitches, score: bestScore, omittedPcs: omitted, doubledPcs: doubled };
}

function emptyScore(): ScoreBreakdown {
  return {
    voiceLeading: 0,
    registerBalance: 0,
    chordClarity: 0,
    templateSimilarity: 0,
    largeLeap: 0,
    muddyLowInterval: 0,
    voiceCrossing: 0,
    excessiveRootDoubling: 0,
    total: 0,
  };
}

export function updateVoicingState(
  state: VoicingState,
  pitches: readonly number[],
  allowed: AllowedToneSet,
): VoicingState {
  return {
    prevPitches: [...pitches],
    prevBass: pitches.length ? Math.min(...pitches) : null,
    prevTop: pitches.length ? Math.max(...pitches) : null,
    prevChordPcs: allowed.pcs,
  };
}
