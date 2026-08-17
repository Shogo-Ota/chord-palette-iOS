/**
 * DEPRECATED ANALYSIS ONLY: Phase 3D attack-by-attack voicing experiment.
 *
 * Production no longer reads Teacher pitch structure. Shared Base Voicing is
 * resolved once per chord and Natural applies atomic subtractive masks.
 */

import type { AllowedToneSet, TemplateNote } from '../strictV2';
import type { VoiceRole } from './degreePitch';
import {
  bassCandidatePcs,
  bodyPcs,
  colorPcs,
  degreeOfPc,
  degreesFromIntervals,
  wrapPc,
  type DegreeInfo,
} from './degreeRoles';
import {
  emptyVoiceLeadingState,
  extractVoiceStructure,
  mergeVoiceLeadingState,
  type VoiceLeadingState,
  type VoiceSlot,
} from './voiceStructure';

export { emptyVoiceLeadingState };
export type { VoiceLeadingState };

const PREFERRED_LO = 36;
const PREFERRED_HI = 79;

export type VoiceStructureRealizeResult = {
  /** Aligned with the input notes. `null` = omitted fallback. */
  pitches: Array<number | null>;
  state: VoiceLeadingState;
  omitted: number;
};

function uniqueInts(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function instanceNear(pc: number, target: number): number {
  const want = wrapPc(pc);
  let best = target;
  let bestDist = 99;
  for (let oct = -2; oct <= 8; oct++) {
    const p = want + 12 * oct;
    if (p < 0 || p > 127) continue;
    const d = Math.abs(p - target);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function instancesNear(pc: number, target: number, below: number): number[] {
  const want = wrapPc(pc);
  const out: number[] = [];
  for (let oct = 0; oct <= 10; oct++) {
    const p = want + 12 * oct;
    if (p > below && p >= 0 && p <= 127) out.push(p);
  }
  return out.sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b).slice(0, 4);
}

function isLegal(
  pitch: number,
  slot: VoiceSlot,
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): boolean {
  if (pitch < 0 || pitch > 127) return false;
  const pc = wrapPc(pitch);
  if (slot.role === 'bass' && slashBassPc != null) return pc === wrapPc(slashBassPc);
  return allowed.containsPc(pc);
}

function hardOk(
  pitches: readonly number[],
  slots: readonly VoiceSlot[],
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): boolean {
  if (pitches.length !== slots.length) return false;
  const seen = new Set<number>();
  for (let i = 0; i < pitches.length; i++) {
    const p = pitches[i]!;
    if (seen.has(p)) return false;
    seen.add(p);
    if (i > 0 && p <= pitches[i - 1]!) return false;
    if (!isLegal(p, slots[i]!, allowed, slashBassPc)) return false;
  }
  return true;
}

function rotateFrom(pcs: readonly number[], start: number): number[] {
  const i = pcs.indexOf(start);
  if (i < 0) return [...pcs];
  return [...pcs.slice(i), ...pcs.slice(0, i)];
}

function pcPatterns(
  slots: readonly VoiceSlot[],
  degrees: readonly DegreeInfo[],
  slashBassPc: number | undefined,
  prev: VoiceLeadingState,
): number[][] {
  const n = slots.length;
  const legal = degrees.map((d) => d.pc);
  if (n === 0 || legal.length === 0) return [];
  const bassPcs = bassCandidatePcs(degrees, slashBassPc);
  const body = bodyPcs(degrees);
  const colors = colorPcs(degrees);
  const patterns: number[][] = [];

  const push = (pcs: number[]) => {
    if (pcs.length === n) patterns.push(pcs);
  };

  for (const bassPc of bassPcs) {
    const cycle = rotateFrom(body.length ? body : legal, bassPc);
    const stack: number[] = [];
    for (let i = 0; i < n; i++) stack.push(cycle[i % cycle.length]!);
    stack[0] = bassPc;
    push(stack);

    if (colors.length) {
      const late = [...stack];
      late[n - 1] = colors[0]!;
      late[0] = bassPc;
      push(late);
      if (n >= 3) {
        const upper = [...stack];
        upper[n - 2] = colors[0]!;
        upper[n - 1] = cycle[1] ?? cycle[0]!;
        upper[0] = bassPc;
        push(upper);
      }
    }
  }

  if (prev.pitches.length) {
    const held = prev.pitches.map((p) => wrapPc(p)).filter((pc) => legal.includes(pc));
    for (const bassPc of bassPcs) {
      const pcs = [bassPc];
      const pool = uniqueInts([...held.filter((pc) => pc !== bassPc), ...legal]);
      for (let i = 1; i < n; i++) pcs.push(pool[(i - 1) % pool.length]!);
      push(pcs);
    }
  }

  const remap: number[] = [];
  for (const slot of slots) {
    const match = degrees.find((d) => d.degree === slot.teacherDegree);
    if (slot.role === 'bass') remap.push(bassPcs[0]!);
    else remap.push(match?.pc ?? legal[remap.length % legal.length]!);
  }
  if (slashBassPc != null) remap[0] = wrapPc(slashBassPc);
  else if (!bassPcs.includes(remap[0]!)) remap[0] = bassPcs[0]!;
  push(remap);

  const keys = new Set<string>();
  return patterns.filter((p) => {
    const k = p.join(',');
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
}

function placeOnTargets(
  slots: readonly VoiceSlot[],
  pcs: readonly number[],
  targets: readonly number[],
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): number[] | null {
  const used = new Set<number>();
  const out: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const below = i === 0 ? -1 : out[i - 1]!;
    const choices = instancesNear(pcs[i]!, targets[i]!, below);
    const pick = choices.find((p) => !used.has(p) && isLegal(p, slots[i]!, allowed, slashBassPc));
    if (pick == null) return null;
    out.push(pick);
    used.add(pick);
  }
  return hardOk(out, slots, allowed, slashBassPc) ? out : null;
}

function placeOnSpacing(
  slots: readonly VoiceSlot[],
  pcs: readonly number[],
  bassMidi: number,
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): number[] | null {
  const teacher0 = slots[0]!.teacherPitch;
  const targets = slots.map((s, i) =>
    i === 0 ? bassMidi : bassMidi + (s.teacherPitch - teacher0),
  );
  return placeOnTargets(slots, pcs, targets, allowed, slashBassPc);
}

function placeOnTeacherRegister(
  slots: readonly VoiceSlot[],
  pcs: readonly number[],
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): number[] | null {
  return placeOnTargets(
    slots,
    pcs,
    slots.map((s) => s.teacherPitch),
    allowed,
    slashBassPc,
  );
}

function bassAnchors(bassPc: number, slots: readonly VoiceSlot[], prev: VoiceLeadingState): number[] {
  const teacherBass = slots[0]!.teacherPitch;
  const targets = [teacherBass, teacherBass + 12, teacherBass - 12];
  if (prev.bass != null) {
    for (const d of [-7, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 7]) {
      targets.push(prev.bass + d);
    }
  }
  if (prev.center != null && prev.span != null) {
    targets.push(prev.center - prev.span / 2);
  }
  return uniqueInts(targets.map((t) => instanceNear(bassPc, t))).filter((p) => {
    if (p < 0 || p > 127) return false;
    if (prev.bass != null && p < 33 && prev.bass >= 36) return false;
    return true;
  });
}

function commonToneCandidate(
  slots: readonly VoiceSlot[],
  degrees: readonly DegreeInfo[],
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
  prev: VoiceLeadingState,
): number[] | null {
  if (prev.pitches.length === 0) return null;
  const legal = new Set(degrees.map((d) => d.pc));
  const kept = prev.pitches.filter((p) => {
    const pc = wrapPc(p);
    if (slashBassPc != null && p === prev.lowest) return pc === wrapPc(slashBassPc);
    return legal.has(pc);
  });
  const n = slots.length;
  let seed = [...kept];
  if (slashBassPc != null) {
    const bass = instanceNear(slashBassPc, prev.bass ?? slots[0]!.teacherPitch);
    seed = [bass, ...seed.filter((p) => p !== bass && wrapPc(p) !== wrapPc(slashBassPc))];
  }
  seed = uniqueInts(seed).sort((a, b) => a - b);

  const colors = colorPcs(degrees);
  const need = [
    ...colors.filter((pc) => !seed.some((p) => wrapPc(p) === pc)),
    ...degrees.map((d) => d.pc).filter((pc) => !seed.some((p) => wrapPc(p) === pc)),
  ];
  for (const pc of uniqueInts(need)) {
    const isColor = colors.includes(pc);
    if (seed.length >= n && !isColor) break;
    const target = isColor
      ? Math.max(seed[seed.length - 1] ?? 60, prev.top ?? 62, 62)
      : (seed[seed.length - 1] ?? prev.center ?? 60);
    let best = -1;
    let bestScore = 1e9;
    for (const t of [target, target + 12, target - 12]) {
      const p = instanceNear(pc, t);
      if (seed.includes(p) || p < 0 || p > 127) continue;
      if (isColor && p < 50) continue;
      if (slashBassPc != null && p < (seed[0] ?? p) && wrapPc(p) !== wrapPc(slashBassPc)) continue;
      const score = Math.abs(p - target);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best < 0) continue;
    if (seed.length >= n && isColor) {
      const replaceAt = seed.length - 1;
      if (wrapPc(seed[replaceAt]!) !== wrapPc(slashBassPc ?? -1)) seed[replaceAt] = best;
    } else {
      seed.push(best);
    }
  }

  while (seed.length < n) {
    const top = seed[seed.length - 1] ?? 60;
    const pc = degrees[seed.length % degrees.length]!.pc;
    const p = instanceNear(pc, top + 12);
    if (seed.includes(p)) break;
    seed.push(p);
  }
  seed = uniqueInts(seed).sort((a, b) => a - b);
  if (seed.length > n) {
    const center = prev.center ?? (seed[0]! + seed[seed.length - 1]!) / 2;
    seed.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    seed = seed.slice(0, n).sort((a, b) => a - b);
  }
  return seed.length === n && hardOk(seed, slots, allowed, slashBassPc) ? seed : null;
}

function pairMovement(prev: readonly number[], next: readonly number[]): number {
  if (prev.length === 0 || next.length === 0) return 0;
  const a = [...prev].sort((x, y) => x - y);
  const b = [...next].sort((x, y) => x - y);
  const m = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < m; i++) sum += Math.abs(a[i]! - b[i]!);
  return sum / m;
}

function scoreCandidate(
  pitches: readonly number[],
  slots: readonly VoiceSlot[],
  degrees: readonly DegreeInfo[],
  prev: VoiceLeadingState,
): number {
  const lowest = pitches[0]!;
  const highest = pitches[pitches.length - 1]!;
  const center = (lowest + highest) / 2;
  const span = highest - lowest;
  let cost = 0;

  if (prev.voiceCount > 0) {
    const commonMidi = pitches.filter((p) => prev.pitches.includes(p)).length;
    const commonPc = pitches.filter((p) => prev.pitches.some((q) => wrapPc(q) === wrapPc(p))).length;
    cost -= commonMidi * 8;
    cost -= commonPc * 3;
    cost += pairMovement(prev.pitches, pitches) * 1.4;
    if (prev.bass != null) cost += Math.abs(lowest - prev.bass) * 1.6;
    if (prev.top != null) cost += Math.abs(highest - prev.top) * 2.2;
    if (prev.center != null) cost += Math.abs(center - prev.center) * 1.6;
    if (prev.span != null) cost += Math.abs(span - prev.span) * 0.9;
    if (prev.top != null && Math.abs(highest - prev.top) >= 12) cost += 16;
    if (prev.bass != null && Math.abs(lowest - prev.bass) >= 12) cost += 12;
  }

  const teacher0 = slots[0]!.teacherPitch;
  const teacherSpan = slots[slots.length - 1]!.teacherPitch - teacher0;
  let spacing = 0;
  for (let i = 1; i < slots.length; i++) {
    const want = slots[i]!.teacherPitch - teacher0;
    const got = pitches[i]! - lowest;
    spacing += Math.abs(got - want);
  }
  cost += spacing * 0.55;
  cost += Math.abs(span - teacherSpan) * (prev.voiceCount > 0 ? 0.25 : 0.7);

  const teacherCenter =
    (slots[0]!.teacherPitch + slots[slots.length - 1]!.teacherPitch) / 2;
  cost += Math.abs(center - teacherCenter) * (prev.voiceCount > 0 ? 0.25 : 1.1);
  cost += Math.abs(lowest - teacher0) * (prev.voiceCount > 0 ? 0.2 : 0.8);
  if (lowest < 33) cost += 18;

  const colors = colorPcs(degrees);
  if (colors.length && pitches.length >= 3) {
    const used = pitches.map((p) => wrapPc(p));
    if (!colors.some((c) => used.includes(c))) cost += 24;
  }

  for (let i = 0; i < pitches.length; i++) {
    const info = degreeOfPc(pitches[i]!, degrees);
    const role = slots[i]!.role;
    if (info?.upperTopAffinity) {
      if (role === 'bass' || i === 0) cost += 32;
      else if (pitches[i]! < 50) cost += 20;
      else if (role === 'top' || role === 'upper') cost -= 6;
    }
    if (role === 'bass' && info && info.degree !== 'root' && info.degree !== 'third' && info.degree !== 'fifth') {
      cost += 20;
    }
    const p = pitches[i]!;
    const teacher = slots[i]!.teacherPitch;
    const teacherOut = teacher < PREFERRED_LO || teacher > PREFERRED_HI;
    if (teacherOut) {
      cost += 0.45 * Math.abs(p - teacher);
    } else if (p < PREFERRED_LO || p > PREFERRED_HI) {
      const over = p < PREFERRED_LO ? PREFERRED_LO - p : p - PREFERRED_HI;
      cost += 0.25 * over;
    }
  }

  return cost;
}

function mutate(
  pitches: readonly number[],
  slots: readonly VoiceSlot[],
  degrees: readonly DegreeInfo[],
  allowed: AllowedToneSet,
  slashBassPc: number | undefined,
): number[][] {
  const out: number[][] = [];
  const legal = degrees.map((d) => d.pc);
  for (let i = 0; i < pitches.length; i++) {
    for (const pc of legal) {
      for (const delta of [-12, 12]) {
        const next = [...pitches];
        next[i] = instanceNear(pc, pitches[i]! + delta);
        if (hardOk(next, slots, allowed, slashBassPc)) out.push(next);
      }
    }
  }
  return out;
}

function omitWorst(
  slots: readonly VoiceSlot[],
  pitches: readonly number[],
): { slots: VoiceSlot[]; pitches: number[]; omittedIndex: number } | null {
  if (slots.length <= 1) return null;
  let worst = 1;
  let worstScore = -1;
  for (let i = 0; i < slots.length; i++) {
    const role = slots[i]!.role;
    const jump =
      i === 0
        ? Math.abs(pitches[1]! - pitches[0]!)
        : i === slots.length - 1
          ? Math.abs(pitches[i]! - pitches[i - 1]!)
          : Math.abs(pitches[i]! - pitches[i - 1]!) + Math.abs(pitches[i + 1]! - pitches[i]!);
    const score = (role === 'inner' ? 2 : 1) * jump;
    if (score > worstScore) {
      worstScore = score;
      worst = i;
    }
  }
  return {
    slots: slots.filter((_, i) => i !== worst),
    pitches: pitches.filter((_, i) => i !== worst),
    omittedIndex: slots[worst]!.index,
  };
}

function continuity(prev: VoiceLeadingState): VoiceLeadingState {
  if (!prev.lastFull) return prev;
  return {
    ...prev,
    pitches: prev.lastFull.pitches,
    bass: prev.lastFull.bass,
    top: prev.lastFull.top,
    center: prev.lastFull.center,
    span: prev.lastFull.span,
    lowest: prev.lastFull.bass,
    highest: prev.lastFull.top,
    voiceCount: prev.lastFull.pitches.length,
  };
}

export function realizeVoiceStructureAttack(
  notes: readonly TemplateNote[],
  allowed: AllowedToneSet,
  prev: VoiceLeadingState,
  slashBassPc?: number,
): VoiceStructureRealizeResult {
  if (notes.length === 0) {
    return { pitches: [], state: prev, omitted: 0 };
  }

  const slots = extractVoiceStructure(notes);
  const anchor = slots.length >= 3 ? continuity(prev) : prev;
  if (slots.length === 1 && prev.top != null && prev.bass != null) {
    const t = slots[0]!.teacherPitch;
    slots[0]!.role = Math.abs(t - prev.top) <= Math.abs(t - prev.bass) ? 'top' : 'bass';
  }
  const degrees = degreesFromIntervals(allowed.rootPc, allowed.intervals);
  const slash = slashBassPc ?? undefined;

  const candidates: number[][] = [];
  const add = (row: number[] | null) => {
    if (!row || !hardOk(row, slots, allowed, slash)) return;
    const colors = colorPcs(degrees);
    if (
      slash == null &&
      colors.length &&
      row.length >= 2 &&
      colors.includes(wrapPc(row[0]!))
    ) {
      return;
    }
    candidates.push(row);
  };

  add(commonToneCandidate(slots, degrees, allowed, slash, anchor));

  for (const pcs of pcPatterns(slots, degrees, slash, anchor)) {
    if (anchor.voiceCount === 0) {
      add(placeOnTeacherRegister(slots, pcs, allowed, slash));
    }
    for (const bass of bassAnchors(pcs[0]!, slots, anchor)) {
      add(placeOnSpacing(slots, pcs, bass, allowed, slash));
    }
  }

  const extras: number[][] = [];
  for (const row of candidates) {
    extras.push(...mutate(row, slots, degrees, allowed, slash));
  }
  for (const row of extras) add(row);

  const unique: number[][] = [];
  const seen = new Set<string>();
  for (const row of candidates) {
    const k = row.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(row);
  }

  let best = unique[0] ?? null;
  let bestScore = Infinity;
  for (const row of unique) {
    const sc = scoreCandidate(row, slots, degrees, anchor);
    if (sc < bestScore) {
      bestScore = sc;
      best = row;
    }
  }

  if (!best && slots.length > 1) {
    const drop = omitWorst(slots, slots.map((s) => s.teacherPitch));
    if (drop) {
          const keptNotes = drop.slots.map((s) => notes[s.index]!);
      const retry = realizeVoiceStructureAttack(keptNotes, allowed, anchor, slash);
      if (retry.omitted === 0 && retry.pitches.every((p) => p != null)) {
        const aligned: Array<number | null> = notes.map(() => null);
        drop.slots.forEach((s, i) => {
          aligned[s.index] = retry.pitches[i] ?? null;
        });
        const kept = aligned.filter((p): p is number => p != null);
        return {
          pitches: aligned,
          state: mergeVoiceLeadingState(prev, kept, drop.slots.map((s) => s.role)),
          omitted: notes.length - kept.length,
        };
      }
    }
  }

  if (!best) {
    return {
      pitches: notes.map(() => null),
      state: prev,
      omitted: notes.length,
    };
  }

  const aligned: Array<number | null> = notes.map(() => null);
  slots.forEach((slot, i) => {
    aligned[slot.index] = best![i]!;
  });
  const roles = slots.map((s) => s.role);
  return {
    pitches: aligned,
    state: mergeVoiceLeadingState(prev, best, roles),
    omitted: 0,
  };
}

export function rolesForPitches(notes: readonly TemplateNote[]): VoiceRole[] {
  const slots = extractVoiceStructure(notes);
  const roles = new Array<VoiceRole>(notes.length).fill('inner');
  for (const s of slots) roles[s.index] = s.role;
  return roles;
}
