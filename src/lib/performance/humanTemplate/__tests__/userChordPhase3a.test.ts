/**
 * Phase 3A: User Chord Authority on Natural Type1 / Variation Type1.
 */
import * as fs from 'fs';
import * as path from 'path';

import { writeSmf } from '@/lib/midiExport/smfWrite';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { intervalsForChord } from '@/lib/theory/definitions';
import { keyTonicPc } from '@/data/music';
import type { ChordEvent, MajorKey } from '@/types';

const ROOT = path.resolve(__dirname, '../../../../../');
const OUT_DIR = path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/phase3a');
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

function allowedPcs(chord: ChordEvent, key: MajorKey): Set<number> {
  const root = (keyTonicPc(key) + (chord.rootOffset ?? 0)) % 12;
  return new Set(intervalsForChord(chord.suffix ?? '', chord.definitionId).map((iv) => (root + iv) % 12));
}

function groups(notes: NoteRow[]): Map<string, NoteRow[]> {
  const map = new Map<string, NoteRow[]>();
  for (const n of notes) {
    const key = (Math.round(n.start * 480) / 480).toFixed(6);
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  return map;
}

function analyze(opts: {
  label: string;
  teacherRel: string;
  planInput: PerformanceSessionInput;
  midiName: string;
}) {
  const teacher = loadTeacher(opts.teacherRel);
  const plan = buildSessionPerformancePlan(opts.planInput);
  const snap = buildFinalMidiSnapshot(plan);
  const genNotes = snap.notes
    .filter((n) => n.track === 'accompaniment')
    .map((n) => ({ start: n.startBeat, dur: n.durationBeat, pitch: n.pitch, vel: n.velocity }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const genCc = [...snap.controlChanges]
    .map((c) => ({ start: c.startBeat, value: c.value }))
    .sort((a, b) => a.start - b.start || a.value - b.value);

  const windows = opts.planInput.progression.map((chord, i) => ({
    start: i * 4,
    end: (i + 1) * 4,
    label: chord.displayName,
    pcs: allowedPcs(chord, opts.planInput.key),
  }));

  const outside: Array<Record<string, unknown>> = [];
  let legal = 0;
  for (const n of genNotes) {
    const w = windows.find((win) => n.start >= win.start - TICK_EPS && n.start < win.end - TICK_EPS) ?? windows[0]!;
    const pc = ((n.pitch % 12) + 12) % 12;
    if (w.pcs.has(pc)) legal += 1;
    else outside.push({ bar: w.label, start: n.start, pitch: n.pitch, pc });
  }

  let duplicates = 0;
  for (const cluster of groups(genNotes).values()) {
    const seen = new Set<number>();
    for (const n of cluster) {
      if (seen.has(n.pitch)) duplicates += 1;
      seen.add(n.pitch);
    }
  }

  const used = new Set<number>();
  let onsetOk = 0;
  let durOk = 0;
  let velOk = 0;
  for (const t of teacher.notes) {
    let best = -1;
    let bestScore = 1e9;
    for (let i = 0; i < genNotes.length; i++) {
      if (used.has(i)) continue;
      const g = genNotes[i]!;
      const score = Math.abs(g.start - t.start) * 1000 + Math.abs(g.dur - t.dur);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) continue;
    used.add(best);
    const g = genNotes[best]!;
    if (near(t.start, g.start)) onsetOk += 1;
    if (near(t.dur, g.dur)) durOk += 1;
    if (t.vel === g.vel) velOk += 1;
  }

  const usedCc = new Set<number>();
  let ccOk = 0;
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
    if (best < 0) continue;
    usedCc.add(best);
    const g = genCc[best]!;
    if (near(t.start, g.start) && t.value === g.value) ccOk += 1;
  }

  const tGroups = groups(teacher.notes);
  const gGroups = groups(genNotes);
  let groupOk = 0;
  for (const [key, tList] of tGroups) {
    const gList = gGroups.get(key);
    if (gList && gList.length === tList.length) groupOk += 1;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const midiPath = path.join(OUT_DIR, opts.midiName);
  fs.writeFileSync(midiPath, Buffer.from(writeSmf(snap)));

  const pitches = genNotes.map((n) => n.pitch);
  return {
    label: opts.label,
    midiPath,
    teacherNoteCount: teacher.notes.length,
    generatedNoteCount: genNotes.length,
    userChordLegalityPct: pct(legal, genNotes.length),
    outsideChordNotes: outside,
    duplicateSimultaneousPitch: duplicates,
    onsetPreservationPct: pct(onsetOk, teacher.notes.length),
    durationPreservationPct: pct(durOk, teacher.notes.length),
    velocityPreservationPct: pct(velOk, teacher.notes.length),
    cc64PreservationPct: pct(ccOk, teacher.cc64.length),
    attackGroupPreservationPct: pct(groupOk, tGroups.size),
    minPitch: pitches.length ? Math.min(...pitches) : null,
    maxPitch: pitches.length ? Math.max(...pitches) : null,
    legacyExtraNotes: plan.notes.filter((n) => n.trackId === 'bass').length,
  };
}

const A1_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_A/P1_A1.mid';
const C12_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_C/P1_C12.mid';

describe('Phase 3A User Chord Authority', () => {
  const midiPresent = fs.existsSync(path.join(ROOT, A1_MIDI)) && fs.existsSync(path.join(ROOT, C12_MIDI));

  const natural = midiPresent
    ? analyze({
        label: 'Natural Type1 C|Am|F|G',
        teacherRel: A1_MIDI,
        planInput: session('C', ['C', 'Am', 'F', 'G'], 'natural', 'natural.type1'),
        midiName: 'natural-type1-C-Am-F-G.mid',
      })
    : null;
  const variation = midiPresent
    ? analyze({
        label: 'Variation Type1 D|Bm|G|A',
        teacherRel: C12_MIDI,
        planInput: session('D', ['D', 'Bm', 'G', 'A'], 'arpeggio', 'arpeggio.type1'),
        midiName: 'variation-type1-D-Bm-G-A.mid',
      })
    : null;

  it('writes Phase 3A MIDI and report', () => {
    expect(midiPresent).toBe(true);
    const report = { natural, variation };
    fs.writeFileSync(
      path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/user_chord_phase3a.json'),
      JSON.stringify(report, null, 2),
    );
    const md = [
      '# Phase 3A — User Chord Authority',
      '',
      'Production: User Chord = WHAT, Teacher = HOW. Pitch classes from the chord symbol only.',
      '',
      ...[natural, variation].flatMap((row) => [
        `## ${row!.label}`,
        '',
        `| 項目 | 値 |`,
        `|---|---|`,
        `| user chord legality | ${row!.userChordLegalityPct}% |`,
        `| outside chord notes | ${row!.outsideChordNotes.length} |`,
        `| duplicate simultaneous pitch | ${row!.duplicateSimultaneousPitch} |`,
        `| onset preservation | ${row!.onsetPreservationPct}% |`,
        `| duration preservation | ${row!.durationPreservationPct}% |`,
        `| velocity preservation | ${row!.velocityPreservationPct}% |`,
        `| CC64 preservation | ${row!.cc64PreservationPct}% |`,
        `| attack group preservation | ${row!.attackGroupPreservationPct}% |`,
        `| min / max pitch | ${row!.minPitch} / ${row!.maxPitch} |`,
        `| MIDI | ${row!.midiPath} |`,
        '',
      ]),
    ].join('\n');
    fs.writeFileSync(path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/user_chord_phase3a.md'), md);
    expect(fs.existsSync(path.join(OUT_DIR, 'natural-type1-C-Am-F-G.mid'))).toBe(true);
    expect(fs.existsSync(path.join(OUT_DIR, 'variation-type1-D-Bm-G-A.mid'))).toBe(true);
  });

  it('Natural Type1 is legal on C|Am|F|G and keeps performance', () => {
    expect(natural).not.toBeNull();
    expect(natural!.legacyExtraNotes).toBe(0);
    expect(natural!.userChordLegalityPct).toBe(100);
    expect(natural!.outsideChordNotes).toEqual([]);
    expect(natural!.duplicateSimultaneousPitch).toBe(0);
    expect(natural!.onsetPreservationPct).toBe(100);
    expect(natural!.durationPreservationPct).toBe(100);
    expect(natural!.velocityPreservationPct).toBe(100);
    expect(natural!.cc64PreservationPct).toBe(100);
    expect(natural!.attackGroupPreservationPct).toBe(100);
  });

  it('Variation Type1 is legal on D|Bm|G|A and keeps performance', () => {
    expect(variation).not.toBeNull();
    expect(variation!.legacyExtraNotes).toBe(0);
    expect(variation!.userChordLegalityPct).toBe(100);
    expect(variation!.outsideChordNotes).toEqual([]);
    expect(variation!.duplicateSimultaneousPitch).toBe(0);
    expect(variation!.onsetPreservationPct).toBe(100);
    expect(variation!.durationPreservationPct).toBe(100);
    expect(variation!.velocityPreservationPct).toBe(100);
    expect(variation!.cc64PreservationPct).toBe(100);
    expect(variation!.attackGroupPreservationPct).toBe(100);
  });
});
