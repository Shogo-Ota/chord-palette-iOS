/**
 * Phase 2 Pure Transpose vs mechanically shifted teacher MIDI.
 * Phase 1 Identity remains the regression gate.
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
const OUT_DIR = path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit');
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

function classifyPitchCause(teacherPitch: number, expected: number, actual: number): string {
  const wrapped = teacherPitch + (((expected - teacherPitch) % 12) + 12) % 12 - 12;
  if (actual === wrapped && actual !== expected) return 'PER_BAR_OCTAVE_WRAP';
  if (actual === teacherPitch) return 'NO_TRANSPOSE';
  return 'PITCH_MISMATCH';
}

function compare(opts: {
  label: string;
  teacherRel: string;
  planInput: PerformanceSessionInput;
  expectedDelta: number;
}) {
  const teacher = loadTeacher(opts.teacherRel);
  const referenceNotes = teacher.notes.map((n) => ({ ...n, pitch: n.pitch + opts.expectedDelta }));
  const plan = buildSessionPerformancePlan(opts.planInput);
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

  for (const t of referenceNotes) {
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
      diffs.push({
        kind: 'MISSING_GENERATED',
        bar: Math.floor(t.start / 4) + 1,
        beat: t.start % 4,
        teacherPitch: t.pitch - opts.expectedDelta,
        expected: t.pitch,
      });
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
      const teacherPitch = t.pitch - opts.expectedDelta;
      diffs.push({
        kind: [!p && 'PITCH', !o && 'ONSET', !d && 'DURATION', !v && 'VELOCITY']
          .filter(Boolean)
          .join('+'),
        bar: Math.floor(t.start / 4) + 1,
        beat: t.start % 4,
        teacherPitch,
        expected: t.pitch,
        actual: g.pitch,
        cause: !p ? classifyPitchCause(teacherPitch, t.pitch, g.pitch) : 'PERFORMANCE_DRIFT',
        codePath: 'realizeDegreePitch + progressionTransposeDelta',
        dOnset: g.start - t.start,
        dDur: g.dur - t.dur,
        dVel: g.vel - t.vel,
      });
    }
  }
  for (let i = 0; i < genNotes.length; i++) {
    if (!used.has(i)) {
      const g = genNotes[i]!;
      diffs.push({
        kind: 'EXTRA_GENERATED',
        bar: Math.floor(g.start / 4) + 1,
        beat: g.start % 4,
        actual: g.pitch,
      });
    }
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

  const pitches = genNotes.map((n) => n.pitch);
  return {
    label: opts.label,
    expectedDelta: opts.expectedDelta,
    teacherNoteCount: teacher.notes.length,
    generatedNoteCount: genNotes.length,
    noteCountMatchPct: pct(
      teacher.notes.length === genNotes.length ? teacher.notes.length : 0,
      teacher.notes.length,
    ),
    pitchMatchPct: pct(pitchOk, teacher.notes.length),
    onsetMatchPct: pct(onsetOk, teacher.notes.length),
    durationMatchPct: pct(durOk, teacher.notes.length),
    velocityMatchPct: pct(velOk, teacher.notes.length),
    cc64MatchPct: pct(ccOk, teacher.cc64.length),
    teacherCc64: teacher.cc64.length,
    generatedCc64: genCc.length,
    legacyExtraNotes: bass.length,
    minGeneratedPitch: pitches.length ? Math.min(...pitches) : null,
    maxGeneratedPitch: pitches.length ? Math.max(...pitches) : null,
    noteDiffs: diffs,
    ccDiffs,
  };
}

function assertPerfect(row: ReturnType<typeof compare>) {
  expect(row.legacyExtraNotes).toBe(0);
  expect(row.generatedNoteCount).toBe(row.teacherNoteCount);
  expect(row.pitchMatchPct).toBe(100);
  expect(row.onsetMatchPct).toBe(100);
  expect(row.durationMatchPct).toBe(100);
  expect(row.velocityMatchPct).toBe(100);
  expect(row.cc64MatchPct).toBe(100);
}

function mdSection(title: string, row: ReturnType<typeof compare>): string {
  const fail = row.noteDiffs.length || row.ccDiffs.length ? 'FAIL' : 'PASS';
  const diffs =
    row.noteDiffs.length === 0 && row.ccDiffs.length === 0
      ? 'なし'
      : [
          ...row.noteDiffs.map((d) => `- ${JSON.stringify(d)}`),
          ...row.ccDiffs.map((d) => `- ${JSON.stringify(d)}`),
        ].join('\n');
  return [
    `## ${title} — ${fail}`,
    '',
    `| 項目 | 値 |`,
    `|---|---|`,
    `| expected delta | ${row.expectedDelta} |`,
    `| teacher note count | ${row.teacherNoteCount} |`,
    `| generated note count | ${row.generatedNoteCount} |`,
    `| note count match | ${row.noteCountMatchPct}% |`,
    `| pitch match | ${row.pitchMatchPct}% |`,
    `| onset match | ${row.onsetMatchPct}% |`,
    `| duration match | ${row.durationMatchPct}% |`,
    `| velocity match | ${row.velocityMatchPct}% |`,
    `| CC64 match | ${row.cc64MatchPct}% |`,
    `| legacy extra notes | ${row.legacyExtraNotes} |`,
    `| min generated pitch | ${row.minGeneratedPitch} |`,
    `| max generated pitch | ${row.maxGeneratedPitch} |`,
    '',
    '### diffs',
    '',
    diffs,
    '',
  ].join('\n');
}

const A1_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_A/P1_A1.mid';
const C12_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_C/P1_C12.mid';

describe('Phase 2 Pure Transpose fidelity', () => {
  const midiPresent = fs.existsSync(path.join(ROOT, A1_MIDI)) && fs.existsSync(path.join(ROOT, C12_MIDI));

  const identityA1 = midiPresent
    ? compare({
        label: 'Identity P1_A1',
        teacherRel: A1_MIDI,
        planInput: session('A', ['A', 'F#m', 'D', 'E'], 'natural', 'natural.type1'),
        expectedDelta: 0,
      })
    : null;
  const identityC12 = midiPresent
    ? compare({
        label: 'Identity P1_C12',
        teacherRel: C12_MIDI,
        planInput: session('C', ['C', 'Am', 'F', 'G'], 'arpeggio', 'arpeggio.type1'),
        expectedDelta: 0,
      })
    : null;
  const transposeA1 = midiPresent
    ? compare({
        label: 'Pure Transpose P1_A1 +3',
        teacherRel: A1_MIDI,
        planInput: session('C', ['C', 'Am', 'F', 'G'], 'natural', 'natural.type1'),
        expectedDelta: 3,
      })
    : null;
  const transposeC12 = midiPresent
    ? compare({
        label: 'Pure Transpose P1_C12 +2',
        teacherRel: C12_MIDI,
        planInput: session('D', ['D', 'Bm', 'G', 'A'], 'arpeggio', 'arpeggio.type1'),
        expectedDelta: 2,
      })
    : null;

  it('writes Phase 2 reports', () => {
    expect(midiPresent).toBe(true);
    const report = { identityA1, identityC12, transposeA1, transposeC12 };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'pure_transpose_phase2.json'), JSON.stringify(report, null, 2));
    const md = [
      '# Phase 2 — Pure Transpose Fidelity',
      '',
      'Golden Reference = Teacher MIDI の NoteOn/NoteOff pitch を機械的に +delta。',
      'Performance（onset / duration / velocity / CC64）は Teacher から不変。',
      '',
      mdSection('Identity regression P1_A1', identityA1!),
      mdSection('Identity regression P1_C12', identityC12!),
      mdSection('Pure Transpose P1_A1 (A|F#m|D|E → C|Am|F|G)', transposeA1!),
      mdSection('Pure Transpose P1_C12 (C|Am|F|G → D|Bm|G|A)', transposeC12!),
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'pure_transpose_phase2.md'), md);
    expect(fs.existsSync(path.join(OUT_DIR, 'pure_transpose_phase2.json'))).toBe(true);
    expect(fs.existsSync(path.join(OUT_DIR, 'pure_transpose_phase2.md'))).toBe(true);
  });

  it('Identity regression P1_A1 stays 100%', () => {
    expect(identityA1).not.toBeNull();
    assertPerfect(identityA1!);
  });

  it('Identity regression P1_C12 stays 100%', () => {
    expect(identityC12).not.toBeNull();
    assertPerfect(identityC12!);
  });

  it('P1_A1 Pure Transpose is teacher +3', () => {
    expect(transposeA1).not.toBeNull();
    expect(transposeA1!.expectedDelta).toBe(3);
    assertPerfect(transposeA1!);
  });

  it('P1_C12 Pure Transpose is teacher +2', () => {
    expect(transposeC12).not.toBeNull();
    expect(transposeC12!.expectedDelta).toBe(2);
    assertPerfect(transposeC12!);
  });
});
