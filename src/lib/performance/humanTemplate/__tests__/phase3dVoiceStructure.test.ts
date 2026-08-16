/**
 * Phase 3D — Voice Structure + voice leading + register continuity.
 */
import * as fs from 'fs';
import * as path from 'path';

import { keyTonicPc } from '@/data/music';
import { writeSmf } from '@/lib/midiExport/smfWrite';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { intervalsForChord } from '@/lib/theory/definitions';
import type { ChordEvent, MajorKey } from '@/types';

import { classifyInterval, degreesFromIntervals, wrapPc } from '../degreeRoles';

const ROOT = path.resolve(__dirname, '../../../../../');
const OUT_DIR = path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/phase3d');
const ORIGIN_TICK = 1920;
const LOOP_BEATS = 16;
const TICK_EPS = 1 / 480 + 1e-9;

type NoteRow = { start: number; dur: number; pitch: number; vel: number };
type CcRow = { start: number; value: number };

function ev(
  rootOffset: number,
  suffix: string,
  displayName: string,
  bassOffset?: number,
): ChordEvent {
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
    ...(bassOffset != null ? { bassOffset } : {}),
  };
}

function session(
  key: MajorKey,
  chords: ChordEvent[],
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
    progression: chords,
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

function chordWindows(progression: ChordEvent[]) {
  return progression.map((chord, i) => ({
    start: i * 4,
    end: (i + 1) * 4,
    label: chord.displayName,
    chord,
  }));
}

function analyzeMain(opts: {
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

  const windows = chordWindows(opts.planInput.progression).map((w) => ({
    ...w,
    pcs: allowedPcs(w.chord, opts.planInput.key),
  }));

  let legal = 0;
  const outside: Array<Record<string, unknown>> = [];
  for (const n of genNotes) {
    const w =
      windows.find((win) => n.start >= win.start - TICK_EPS && n.start < win.end - TICK_EPS) ??
      windows[0]!;
    const pc = wrapPc(n.pitch);
    if (w.pcs.has(pc)) legal += 1;
    else outside.push({ bar: w.label, start: n.start, pitch: n.pitch, pc });
  }

  let duplicates = 0;
  let crossings = 0;
  for (const cluster of groups(genNotes).values()) {
    const seen = new Set<number>();
    const sorted = [...cluster].sort((a, b) => a.pitch - b.pitch);
    for (let i = 0; i < cluster.length; i++) {
      if (seen.has(cluster[i]!.pitch)) duplicates += 1;
      seen.add(cluster[i]!.pitch);
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.pitch <= sorted[i - 1]!.pitch) crossings += 1;
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

  const perChord = windows.map((w) => {
    const notes = genNotes.filter((n) => n.start >= w.start - TICK_EPS && n.start < w.end - TICK_EPS);
    const pitches = notes.map((n) => n.pitch);
    const lowest = pitches.length ? Math.min(...pitches) : null;
    const highest = pitches.length ? Math.max(...pitches) : null;
    return {
      chord: w.label,
      lowest,
      highest,
      center: lowest != null && highest != null ? (lowest + highest) / 2 : null,
      span: lowest != null && highest != null ? highest - lowest : null,
      voiceCount: pitches.length,
    };
  });

  const registerCenterChange = perChord.map((row, i) => {
    if (i === 0 || row.center == null || perChord[i - 1]!.center == null) return 0;
    return Math.round((row.center - perChord[i - 1]!.center!) * 100) / 100;
  });
  const spanChange = perChord.map((row, i) => {
    if (i === 0 || row.span == null || perChord[i - 1]!.span == null) return 0;
    return row.span - perChord[i - 1]!.span!;
  });
  const bassMovement = perChord.map((row, i) => {
    if (i === 0 || row.lowest == null || perChord[i - 1]!.lowest == null) return 0;
    return row.lowest - perChord[i - 1]!.lowest!;
  });
  const topMovement = perChord.map((row, i) => {
    if (i === 0 || row.highest == null || perChord[i - 1]!.highest == null) return 0;
    return row.highest - perChord[i - 1]!.highest!;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const midiPath = path.join(OUT_DIR, opts.midiName);
  fs.writeFileSync(midiPath, Buffer.from(writeSmf(snap)));

  const pitches = genNotes.map((n) => n.pitch);
  return {
    label: opts.label,
    midiPath,
    userChordLegalityPct: pct(legal, genNotes.length),
    outsideChordNotes: outside,
    identicalMidiDuplicates: duplicates,
    voiceCrossing: crossings,
    attackGroupPreservationPct: pct(groupOk, tGroups.size),
    onsetPreservationPct: pct(onsetOk, teacher.notes.length),
    durationPreservationPct: pct(durOk, teacher.notes.length),
    velocityPreservationPct: pct(velOk, teacher.notes.length),
    cc64PreservationPct: pct(ccOk, teacher.cc64.length),
    minPitch: pitches.length ? Math.min(...pitches) : null,
    maxPitch: pitches.length ? Math.max(...pitches) : null,
    perChord,
    registerCenterChange,
    spanChange,
    bassMovement,
    topNoteMovement: topMovement,
    generatedNoteCount: genNotes.length,
    teacherNoteCount: teacher.notes.length,
  };
}

function analyzeExtension(planInput: PerformanceSessionInput) {
  const plan = buildSessionPerformancePlan(planInput);
  const snap = buildFinalMidiSnapshot(plan);
  const genNotes = snap.notes
    .filter((n) => n.track === 'accompaniment')
    .map((n) => ({ start: n.startBeat, dur: n.durationBeat, pitch: n.pitch, vel: n.velocity }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const midiPath = path.join(OUT_DIR, 'extension-C-Cadd9-Cmaj7-C7.mid');
  fs.writeFileSync(midiPath, Buffer.from(writeSmf(snap)));

  const windows = chordWindows(planInput.progression);
  const attacks: Array<{
    chord: string;
    start: number;
    voices: Array<{ degree: string; midi: number; role: string }>;
  }> = [];

  for (const [startKey, cluster] of groups(genNotes)) {
    const start = cluster[0]!.start;
    const w =
      windows.find((win) => start >= win.start - TICK_EPS && start < win.end - TICK_EPS) ??
      windows[0]!;
    const root = (keyTonicPc(planInput.key) + (w.chord.rootOffset ?? 0)) % 12;
    const degrees = degreesFromIntervals(
      root,
      intervalsForChord(w.chord.suffix ?? '', w.chord.definitionId),
    );
    const sorted = [...cluster].sort((a, b) => a.pitch - b.pitch);
    const n = sorted.length;
    attacks.push({
      chord: w.chord.displayName,
      start: Number(startKey),
      voices: sorted.map((note, i) => {
        const info = degrees.find((d) => d.pc === wrapPc(note.pitch));
        const role = n === 1 ? 'top' : i === 0 ? 'bass' : i === n - 1 ? 'top' : i === n - 2 ? 'upper' : 'inner';
        return {
          degree: info?.degree ?? classifyInterval(wrapPc(note.pitch - root)),
          midi: note.pitch,
          role,
        };
      }),
    });
  }

  const colorLow: string[] = [];
  const topJumps: number[] = [];
  let prevTop: number | null = null;
  let prevCenter: number | null = null;
  const centerJumps: number[] = [];

  for (const attack of attacks) {
    const pitches = attack.voices.map((v) => v.midi);
    const center = (Math.min(...pitches) + Math.max(...pitches)) / 2;
    for (const v of attack.voices) {
      if ((v.degree === 'ninth' || v.degree === 'eleventh' || v.degree === 'thirteenth') && v.midi < 50) {
        colorLow.push(`${attack.chord} ${v.degree}=${v.midi}`);
      }
    }
    if (attack.voices.length < 3) continue;
    const top = attack.voices[attack.voices.length - 1]!.midi;
    if (prevTop != null) topJumps.push(top - prevTop);
    if (prevCenter != null) centerJumps.push(center - prevCenter);
    prevTop = top;
    prevCenter = center;
  }

  return {
    midiPath,
    attacks,
    colorInLowRegister: colorLow,
    maxAbsTopJump: topJumps.length ? Math.max(...topJumps.map((d) => Math.abs(d))) : 0,
    maxAbsCenterJump: centerJumps.length ? Math.max(...centerJumps.map((d) => Math.abs(d))) : 0,
  };
}

const A1_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_A/P1_A1.mid';
const C12_MIDI = 'LocalDatasets/AccompanimentMidi/PianoMidiCollection/midi/P1_C/P1_C12.mid';

describe('Phase 3D Voice Structure', () => {
  const midiPresent = fs.existsSync(path.join(ROOT, A1_MIDI)) && fs.existsSync(path.join(ROOT, C12_MIDI));

  const natural = midiPresent
    ? analyzeMain({
        label: 'Natural Type1 C|Am|F|G',
        teacherRel: A1_MIDI,
        planInput: session(
          'C',
          [ev(0, '', 'C'), ev(9, 'm', 'Am'), ev(5, '', 'F'), ev(7, '', 'G')],
          'natural',
          'natural.type1',
        ),
        midiName: 'natural-type1-C-Am-F-G.mid',
      })
    : null;

  const variation = midiPresent
    ? analyzeMain({
        label: 'Variation Type1 D|Bm|G|A',
        teacherRel: C12_MIDI,
        planInput: session(
          'D',
          [ev(0, '', 'D'), ev(9, 'm', 'Bm'), ev(5, '', 'G'), ev(7, '', 'A')],
          'arpeggio',
          'arpeggio.type1',
        ),
        midiName: 'variation-type1-D-Bm-G-A.mid',
      })
    : null;

  const extension = analyzeExtension(
    session(
      'C',
      [ev(0, '', 'C'), ev(0, 'add9', 'Cadd9'), ev(0, 'maj7', 'Cmaj7'), ev(0, '7', 'C7')],
      'natural',
      'natural.type1',
    ),
  );

  it('writes Phase 3D MIDI and report', () => {
    expect(midiPresent).toBe(true);
    const report = { natural, variation, extension };
    fs.writeFileSync(path.join(OUT_DIR, 'phase3d_voice_structure.json'), JSON.stringify(report, null, 2));
    const rowMd = (row: NonNullable<typeof natural>) =>
      [
        `## ${row.label}`,
        '',
        `| 項目 | 値 |`,
        `|---|---|`,
        `| user chord legality | ${row.userChordLegalityPct}% |`,
        `| identical MIDI duplicates | ${row.identicalMidiDuplicates} |`,
        `| voice crossing | ${row.voiceCrossing} |`,
        `| attack group preservation | ${row.attackGroupPreservationPct}% |`,
        `| onset preservation | ${row.onsetPreservationPct}% |`,
        `| duration preservation | ${row.durationPreservationPct}% |`,
        `| velocity preservation | ${row.velocityPreservationPct}% |`,
        `| CC64 preservation | ${row.cc64PreservationPct}% |`,
        `| min / max pitch | ${row.minPitch} / ${row.maxPitch} |`,
        `| register center change | ${row.registerCenterChange.join(', ')} |`,
        `| span change | ${row.spanChange.join(', ')} |`,
        `| bass movement | ${row.bassMovement.join(', ')} |`,
        `| top-note movement | ${row.topNoteMovement.join(', ')} |`,
        `| MIDI | ${row.midiPath} |`,
        '',
      ].join('\n');

    const extLines = extension.attacks.map(
      (a) =>
        `- ${a.chord} @${a.start.toFixed(3)}: ${a.voices.map((v) => `${v.role}:${v.degree}:${v.midi}`).join(' | ')}`,
    );
    const md = [
      '# Phase 3D — Voice Structure',
      '',
      'User Harmony + Teacher Performance + Voice Leading + Register Continuity.',
      'onset / duration / velocity / CC64 / Playback / Teacher JSON / teacherFidelity は未変更。',
      '',
      rowMd(natural!),
      rowMd(variation!),
      '## Extension C | Cadd9 | Cmaj7 | C7',
      '',
      ...extLines,
      '',
      `- color in low register: ${extension.colorInLowRegister.length ? extension.colorInLowRegister.join('; ') : 'none'}`,
      `- max |top jump|: ${extension.maxAbsTopJump}`,
      `- max |register center jump|: ${extension.maxAbsCenterJump}`,
      `- MIDI: ${extension.midiPath}`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'phase3d_voice_structure.md'), md);
    expect(fs.existsSync(path.join(OUT_DIR, 'natural-type1-C-Am-F-G.mid'))).toBe(true);
    expect(fs.existsSync(path.join(OUT_DIR, 'variation-type1-D-Bm-G-A.mid'))).toBe(true);
    expect(fs.existsSync(path.join(OUT_DIR, 'extension-C-Cadd9-Cmaj7-C7.mid'))).toBe(true);
  });

  it('Natural / Variation keep 3A hard contracts and performance HOW', () => {
    for (const row of [natural, variation]) {
      expect(row).not.toBeNull();
      expect(row!.userChordLegalityPct).toBe(100);
      expect(row!.identicalMidiDuplicates).toBe(0);
      expect(row!.voiceCrossing).toBe(0);
      expect(row!.onsetPreservationPct).toBe(100);
      expect(row!.durationPreservationPct).toBe(100);
      expect(row!.velocityPreservationPct).toBe(100);
      expect(row!.cc64PreservationPct).toBe(100);
      expect(row!.attackGroupPreservationPct).toBe(100);
    }
  });

  it('does not clamp Variation tops to 84', () => {
    expect(variation!.maxPitch).toBeGreaterThan(84);
  });

  it('Extension color stays out of the bass and register stays connected', () => {
    expect(extension.colorInLowRegister).toEqual([]);
    expect(extension.maxAbsTopJump).toBeLessThan(12);
    expect(extension.maxAbsCenterJump).toBeLessThan(12);
    const add9 = extension.attacks.filter((a) => a.chord === 'Cadd9');
    expect(add9.some((a) => a.voices.some((v) => v.degree === 'ninth' && (v.role === 'top' || v.role === 'upper')))).toBe(
      true,
    );
  });
});
