/**
 * Teacher-MIDI ingest pipeline unit tests (docs/midi_dataset_policy.md).
 *
 * The SMF fixtures are BUILT here byte-by-byte — no real MIDI file enters the
 * repository — so the parse → relativize → validate roundtrip is proven on
 * fully known input, including the policy behaviours: manual-review entries
 * are skipped, missing license blocks ingest, non-chord tones are excluded
 * and counted rather than bent, and nothing throws on musical oddities.
 */

import type { MidiRegistry, MidiRegistryEntry } from '../registry';
import { registryEntryProblems, selectIngestible } from '../registry';
import { relativizeSmf } from '../relativize';
import { parseSmf } from '../smf';

/* ---------------------------------------------------------------- */
/* SMF fixture builder                                               */
/* ---------------------------------------------------------------- */

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  let rest = n >> 7;
  while (rest > 0) {
    out.unshift((rest & 0x7f) | 0x80);
    rest >>= 7;
  }
  return out;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

const END_OF_TRACK = [0x00, 0xff, 0x2f, 0x00];

function buildSmf(ppq: number, trackBodies: number[][]): Uint8Array {
  const bytes: number[] = [
    0x4d, 0x54, 0x68, 0x64, ...u32(6),
    0x00, trackBodies.length > 1 ? 0x01 : 0x00,
    (trackBodies.length >> 8) & 0xff, trackBodies.length & 0xff,
    (ppq >> 8) & 0xff, ppq & 0xff,
  ];
  for (const body of trackBodies) {
    bytes.push(0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body);
  }
  return Uint8Array.from(bytes);
}

/** delta, then note-on/off on channel 0. */
const on = (delta: number, pitch: number, vel: number) => [...vlq(delta), 0x90, pitch, vel];
const off = (delta: number, pitch: number) => [...vlq(delta), 0x80, pitch, 0x40];

/* ---------------------------------------------------------------- */
/* Registry fixture                                                  */
/* ---------------------------------------------------------------- */

function entry(overrides: Partial<MidiRegistryEntry> = {}): MidiRegistryEntry {
  return {
    id: 'ballad.hold.test',
    name: 'Ballad hold study',
    style: 'ballad',
    instrumentRole: 'piano',
    sourceType: 'original',
    usage: 'Ballad hold パターンの研究',
    rights: {
      sourceName: 'オーナー打ち込み',
      sourceURL: '',
      productName: '',
      purchaseDate: '',
      licenseType: '自作',
      allowedUsage: '無制限（オーナー打ち込み）',
      redistributionAllowed: true,
      commercialUseAllowed: true,
      derivativeUseAllowed: true,
      verificationStatus: 'verified',
    },
    file: 'assets_dev/midi_teacher/ballad/hold-test.mid',
    annotation: {
      rootPc: 0, // C
      chordIntervals: [0, 4, 7, 11], // Cmaj7
      rhythmFeel: 'straight',
      timeSignature: { beatsPerBar: 4, beatUnit: 4 },
      bars: 1,
      bpmRange: { min: 60, max: 90 },
      tags: ['hold'],
    },
    ...overrides,
  };
}

/* ---------------------------------------------------------------- */
/* SMF parser                                                        */
/* ---------------------------------------------------------------- */

describe('parseSmf', () => {
  it('reads paired notes, tempo and time signature', () => {
    const ppq = 480;
    const body = [
      // tempo 500000us (120 BPM), 4/4
      ...vlq(0), 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
      ...vlq(0), 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
      ...on(0, 60, 96),
      ...off(480, 60),
      ...on(0, 64, 80),
      ...off(960, 64),
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(ppq, [body]));

    expect(song.ppq).toBe(480);
    expect(song.tempos).toEqual([{ tick: 0, usPerQuarter: 500000 }]);
    expect(song.timeSignatures).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
    expect(song.notes).toEqual([
      { tick: 0, pitch: 60, velocity: 96, durTicks: 480, channel: 0, track: 0 },
      { tick: 480, pitch: 64, velocity: 80, durTicks: 960, channel: 0, track: 0 },
    ]);
    expect(song.warnings).toEqual([]);
  });

  it('handles running status and note-on velocity 0 as note-off', () => {
    const body = [
      ...vlq(0), 0x90, 60, 100, // note-on with status byte
      ...vlq(0), 64, 90, // running status: second note-on
      ...vlq(480), 60, 0, // running status: vel-0 == off
      ...vlq(0), 64, 0,
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(480, [body]));
    expect(song.notes.map((n) => [n.pitch, n.durTicks])).toEqual([
      [60, 480],
      [64, 480],
    ]);
  });

  it('closes unterminated notes at track end with a warning', () => {
    const body = [...on(0, 48, 70), ...vlq(960), ...END_OF_TRACK.slice(1)];
    const song = parseSmf(buildSmf(480, [body]));
    expect(song.notes).toHaveLength(1);
    expect(song.notes[0].durTicks).toBe(960);
    expect(song.warnings.join(' ')).toContain('no note-off');
  });

  it('rejects non-SMF bytes and SMPTE division with clear errors', () => {
    expect(() => parseSmf(Uint8Array.from([1, 2, 3, 4]))).toThrow('MThd');
    const smpte = buildSmf(480, [[...END_OF_TRACK]]);
    smpte[12] = 0xe8; // set division top bit (SMPTE)
    expect(() => parseSmf(smpte)).toThrow('SMPTE');
  });
});

/* ---------------------------------------------------------------- */
/* Registry rules                                                    */
/* ---------------------------------------------------------------- */

describe('registry (rights ledger)', () => {
  const withRights = (
    id: string,
    rights: Partial<MidiRegistryEntry['rights']>,
  ): MidiRegistryEntry => {
    const base = entry({ id });
    return { ...base, rights: { ...base.rights, ...rights } };
  };

  it('skips manual_review_required and rejected entries without halting', () => {
    const registry: MidiRegistry = {
      version: 1,
      entries: [
        entry({ id: 'ok' }),
        withRights('unknown-rights', { verificationStatus: 'manual_review_required' }),
        withRights('refused', { verificationStatus: 'rejected' }),
      ],
    };
    const { ingestible, skipped } = selectIngestible(registry);
    expect(ingestible.map((e) => e.id)).toEqual(['ok']);
    expect(skipped).toEqual([
      { id: 'unknown-rights', reason: 'verificationStatus is "manual_review_required"' },
      { id: 'refused', reason: 'verificationStatus is "rejected"' },
    ]);
  });

  it('skips verified material whose license forbids derivative use', () => {
    const listenOnly = withRights('yamaha-study', { derivativeUseAllowed: false });
    const { ingestible, skipped } = selectIngestible({ version: 1, entries: [listenOnly] });
    expect(ingestible).toEqual([]);
    expect(skipped[0].reason).toContain('derivativeUseAllowed');
  });

  it('blocks verified entries whose rights fields are empty (記録義務)', () => {
    const bad = withRights('no-license', { licenseType: '' });
    expect(registryEntryProblems(bad).join(' ')).toContain('licenseType');
    const { ingestible, skipped } = selectIngestible({ version: 1, entries: [bad] });
    expect(ingestible).toEqual([]);
    expect(skipped[0].reason).toContain('licenseType');
  });

  it('requires purchase provenance for non-original material', () => {
    const purchased = entry({ id: 'ezkeys', sourceType: 'licensed' });
    const problems = registryEntryProblems(purchased).join(' ');
    expect(problems).toContain('sourceURL');
    expect(problems).toContain('productName');
    expect(problems).toContain('purchaseDate');
  });

  it('rejects malformed chord annotations', () => {
    const noRoot = entry({
      annotation: { ...entry().annotation, chordIntervals: [4, 7] },
    });
    expect(registryEntryProblems(noRoot).join(' ')).toContain('start at 0');
  });
});

/* ---------------------------------------------------------------- */
/* Relativization                                                    */
/* ---------------------------------------------------------------- */

describe('relativizeSmf', () => {
  const now = () => '2026-08-02T00:00:00.000Z';

  it('converts chord tones to fully relative notes that pass validation', () => {
    // Cmaj7 frame: C4 (root, home octave), E5 (3rd, +1 octave), G2 low (5th, -2).
    const body = [
      ...on(0, 60, 100), ...off(480, 60),
      ...on(0, 76, 80), ...off(480, 76),
      ...on(0, 43, 60), ...off(480, 43),
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(480, [body]));
    const { pattern, report } = relativizeSmf(song, entry(), now);

    expect(report.problems).toEqual([]);
    expect(pattern).not.toBeNull();
    expect(pattern!.patternLengthBeats).toBe(4);
    expect(pattern!.notes).toEqual([
      // C4 = root in home octave; velocity peak normalizes to 1.
      { posBeats: 0, chordToneIndex: 0, octaveOffset: 0, velocityRatio: 1, durationBeats: 1 },
      // E5 = 3rd one octave above home.
      { posBeats: 1, chordToneIndex: 1, octaveOffset: 1, velocityRatio: 0.8, durationBeats: 1 },
      // G2 = 5th two octaves below home (piano home = C4..B4).
      { posBeats: 2, chordToneIndex: 2, octaveOffset: -2, velocityRatio: 0.6, durationBeats: 1 },
    ]);
    expect(pattern!.accentMap).toEqual([1, 0.8, 0.6, 0]);
    expect(pattern!.license).toBe('自作 — オーナー打ち込み');
  });

  it('excludes and counts non-chord tones instead of bending them', () => {
    const body = [
      ...on(0, 60, 100), ...off(480, 60),
      ...on(0, 61, 90), ...off(480, 61), // C# — not in Cmaj7
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(480, [body]));
    const { pattern, report } = relativizeSmf(song, entry(), now);
    expect(report.nonChordTonesExcluded).toBe(1);
    expect(report.notesIngested).toBe(1);
    expect(pattern!.notes).toHaveLength(1);
  });

  it('excludes notes outside the annotated pattern length', () => {
    const body = [
      ...on(0, 60, 100), ...off(480, 60),
      ...on(480 * 4, 64, 90), ...off(480, 64), // starts at beat 5 of a 4-beat pattern
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(480, [body]));
    const { report } = relativizeSmf(song, entry(), now);
    expect(report.outsideLengthExcluded).toBe(1);
    expect(report.notesIngested).toBe(1);
  });

  it('refuses drum entries (not chord-relative in v1) without throwing', () => {
    const body = [...on(0, 36, 100), ...off(480, 36), ...END_OF_TRACK];
    const song = parseSmf(buildSmf(480, [body]));
    const { pattern, report } = relativizeSmf(song, entry({ instrumentRole: 'drums' }), now);
    expect(pattern).toBeNull();
    expect(report.problems.join(' ')).toContain('drums');
  });

  it('returns problems instead of a pattern when nothing is ingestible', () => {
    const body = [...on(0, 61, 100), ...off(480, 61), ...END_OF_TRACK]; // NCT only
    const song = parseSmf(buildSmf(480, [body]));
    const { pattern, report } = relativizeSmf(song, entry(), now);
    expect(pattern).toBeNull();
    expect(report.problems.join(' ')).toContain('no ingestible notes');
  });
});
