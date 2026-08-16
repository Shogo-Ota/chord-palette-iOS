/**
 * Phase 1 Identity: P1_A1 and P1_C12 vs the teacher MIDI Golden Master (loop bars 1–4).
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import type { ChordEvent, MajorKey } from '@/types';

const ROOT = path.resolve(__dirname, '../../../../../');
const ORIGIN_TICK = 1920;
const LOOP_BEATS = 16;
const TICK_EPS = 1 / 480 + 1e-9;

type NoteRow = { start: number; dur: number; pitch: number; vel: number };
type CcRow = { start: number; value: number };

function ev(rootOffset: number, suffix: string, displayName: string): ChordEvent {
  return {
    id: `id-${displayName}`,
    chordId: `id-${displayName}`,
    rootOffset,
    suffix,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
  };
}

const I_VI_IV_V: Array<[number, string]> = [
  [0, ''],
  [9, 'm'],
  [5, ''],
  [7, ''],
];

function prog(names: [string, string, string, string]): ChordEvent[] {
  return I_VI_IV_V.map(([off, suf], i) => ev(off, suf, names[i]!));
}

function session(
  key: MajorKey,
  names: [string, string, string, string],
  pattern: 'natural' | 'arpeggio',
  variant: string,
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
    humanTemplatePitchMode: 'teacherFidelity',
    progression: prog(names),
  };
}

function loadTeacher(rel: string): { notes: NoteRow[]; cc64: CcRow[] } {
  const song = parseSmf(new Uint8Array(fs.readFileSync(path.join(ROOT, rel))));
  const originBeat = ORIGIN_TICK / song.ppq;
  const notes = song.notes
    .filter((n) => n.channel !== 9)
    .map((n) => ({
      start: n.tick / song.ppq - originBeat,
      dur: n.durTicks / song.ppq,
      pitch: n.pitch,
      vel: n.velocity,
    }))
    .filter((n) => n.start >= -TICK_EPS && n.start < LOOP_BEATS - TICK_EPS)
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const cc64 = song.controlChanges
    .filter((c) => c.controller === 64)
    .map((c) => ({ start: c.tick / song.ppq - originBeat, value: c.value }))
    .filter((c) => c.start >= -TICK_EPS && c.start < LOOP_BEATS - TICK_EPS)
    .sort((a, b) => a.start - b.start || a.value - b.value);
  return { notes, cc64 };
}

function pct(ok: number, n: number): number {
  if (n === 0) return 100;
  return Math.round((10000 * ok) / n) / 100;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= TICK_EPS;
}

function compare(label: string, teacherRel: string, planInput: PerformanceSessionInput) {
  const teacher = loadTeacher(teacherRel);
  const plan = buildSessionPerformancePlan(planInput);
  const snap = buildFinalMidiSnapshot(plan);
  const genNotes = snap.notes
    .filter((n) => n.track === 'accompaniment')
    .map((n) => ({ start: n.startBeat, dur: n.durationBeat, pitch: n.pitch, vel: n.velocity }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const genCc = [...snap.controlChanges]
    .map((c) => ({ start: c.startBeat, value: c.value }))
    .sort((a, b) => a.start - b.start || a.value - b.value);
  const bass = plan.notes.filter((n) => n.trackId === 'bass');

  const used = new Set<number>();
  let pitchOk = 0;
  let onsetOk = 0;
  let durOk = 0;
  let velOk = 0;
  const diffs: Array<Record<string, unknown>> = [];

  for (const t of teacher.notes) {
    let best = -1;
    let bestScore = 1e9;
    for (let i = 0; i < genNotes.length; i++) {
      if (used.has(i)) continue;
      const g = genNotes[i]!;
      const score =
        Math.abs(g.start - t.start) * 1000 + Math.abs(g.pitch - t.pitch) * 10 + Math.abs(g.dur - t.dur);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) {
      diffs.push({ kind: 'MISSING_GENERATED', teacher: t });
      continue;
    }
    used.add(best);
    const g = genNotes[best]!;
    const p = t.pitch === g.pitch;
    const o = near(t.start, g.start);
    const d = near(t.dur, g.dur);
    const v = t.vel === g.vel;
    if (p) pitchOk += 1;
    if (o) onsetOk += 1;
    if (d) durOk += 1;
    if (v) velOk += 1;
    if (!p || !o || !d || !v) {
      diffs.push({
        kind: [!p && 'PITCH', !o && 'ONSET', !d && 'DURATION', !v && 'VELOCITY']
          .filter(Boolean)
          .join('+'),
        teacher: t,
        generated: g,
        dPitch: g.pitch - t.pitch,
        dOnset: g.start - t.start,
        dDur: g.dur - t.dur,
        dVel: g.vel - t.vel,
      });
    }
  }
  for (let i = 0; i < genNotes.length; i++) {
    if (!used.has(i)) diffs.push({ kind: 'EXTRA_GENERATED', generated: genNotes[i] });
  }

  const usedCc = new Set<number>();
  let ccOk = 0;
  const ccDiffs: Array<Record<string, unknown>> = [];
  for (const t of teacher.cc64) {
    let best = -1;
    let bestScore = 1e9;
    for (let i = 0; i < genCc.length; i++) {
      if (usedCc.has(i)) continue;
      const g = genCc[i]!;
      const score = Math.abs(g.start - t.start) * 1000 + Math.abs(g.value - t.value);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) {
      ccDiffs.push({ kind: 'MISSING_CC', teacher: t });
      continue;
    }
    usedCc.add(best);
    const g = genCc[best]!;
    if (near(t.start, g.start) && t.value === g.value) ccOk += 1;
    else ccDiffs.push({ kind: 'CC64', teacher: t, generated: g });
  }
  for (let i = 0; i < genCc.length; i++) {
    if (!usedCc.has(i)) ccDiffs.push({ kind: 'EXTRA_CC', generated: genCc[i] });
  }

  const kindCounts: Record<string, number> = {};
  for (const d of diffs) {
    const k = String(d.kind);
    kindCounts[k] = (kindCounts[k] ?? 0) + 1;
  }

  return {
    label,
    teacherNoteCount: teacher.notes.length,
    generatedNoteCount: genNotes.length,
    pitchMatchPct: pct(pitchOk, teacher.notes.length),
    onsetMatchPct: pct(onsetOk, teacher.notes.length),
    durationMatchPct: pct(durOk, teacher.notes.length),
    velocityMatchPct: pct(velOk, teacher.notes.length),
    cc64MatchPct: pct(ccOk, teacher.cc64.length),
    teacherCc64: teacher.cc64.length,
    generatedCc64: genCc.length,
    legacyExtraNotes: bass.length,
    noteDiffKindCounts: kindCounts,
    noteDiffs: diffs,
    ccDiffs,
  };
}

const A1_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_A/P1_A1.mid';
const C12_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_C/P1_C12.mid';

describe('Phase 1 Identity fidelity', () => {
  const midiPresent = fs.existsSync(path.join(ROOT, A1_MIDI)) && fs.existsSync(path.join(ROOT, C12_MIDI));

  const a1 = midiPresent
    ? compare(
        'P1_A1 Natural Type1',
        A1_MIDI,
        session('A', ['A', 'F#m', 'D', 'E'], 'natural', 'natural.type1'),
      )
    : null;
  const c12 = midiPresent
    ? compare(
        'P1_C12 Variation Type1',
        C12_MIDI,
        session('C', ['C', 'Am', 'F', 'G'], 'arpeggio', 'arpeggio.type1'),
      )
    : null;

  it('writes the identity report', () => {
    expect(midiPresent).toBe(true);
    const out = path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/identity_phase1.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ a1, c12 }, null, 2));
    expect(fs.existsSync(out)).toBe(true);
  });

  it('P1_A1 has no legacy bass and matches the teacher loop', () => {
    expect(a1).not.toBeNull();
    expect(a1!.legacyExtraNotes).toBe(0);
    expect(a1!.generatedNoteCount).toBe(a1!.teacherNoteCount);
    expect(a1!.pitchMatchPct).toBe(100);
    expect(a1!.onsetMatchPct).toBe(100);
    expect(a1!.durationMatchPct).toBe(100);
    expect(a1!.velocityMatchPct).toBe(100);
    expect(a1!.cc64MatchPct).toBe(100);
  });

  it('P1_C12 has no legacy bass and matches the teacher loop', () => {
    expect(c12).not.toBeNull();
    expect(c12!.legacyExtraNotes).toBe(0);
    expect(c12!.generatedNoteCount).toBe(c12!.teacherNoteCount);
    expect(c12!.pitchMatchPct).toBe(100);
    expect(c12!.onsetMatchPct).toBe(100);
    expect(c12!.durationMatchPct).toBe(100);
    expect(c12!.velocityMatchPct).toBe(100);
    expect(c12!.cc64MatchPct).toBe(100);
  });
});
