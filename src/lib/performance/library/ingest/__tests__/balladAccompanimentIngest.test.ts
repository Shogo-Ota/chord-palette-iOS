/**
 * Phase 2: Ballad accompaniment-purpose MIDI → relativize → whitelist extract.
 * Fixture SMF is built in-test (no commercial song file in the repo).
 */

import { extractPatternSummary } from '@/lib/performance/library';
import type { MidiRegistryEntry } from '../registry';
import { relativizeSmf } from '../relativize';
import { parseSmf } from '../smf';

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
const on = (delta: number, pitch: number, vel: number) => [...vlq(delta), 0x90, pitch, vel];
const off = (delta: number, pitch: number) => [...vlq(delta), 0x80, pitch, 0x40];

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

function balladEntry(): MidiRegistryEntry {
  return {
    id: 'ballad.piano.brokenHold.ingestFixture',
    name: 'Ballad piano broken hold (ingest fixture)',
    style: 'ballad',
    instrumentRole: 'piano',
    sourceType: 'original',
    usage: '伴奏用オリジナルMIDIの相対抽出検証',
    rights: {
      sourceName: 'オーナー伴奏用打ち込み',
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
    file: 'assets_dev/midi_teacher/ballad/broken-hold-fixture.mid',
    annotation: {
      rootPc: 0,
      chordIntervals: [0, 4, 7],
      rhythmFeel: 'straight',
      timeSignature: { beatsPerBar: 4, beatUnit: 4 },
      bars: 1,
      bpmRange: { min: 60, max: 100 },
      tags: ['ballad', 'accompaniment', 'fixture'],
    },
  };
}

describe('Ballad accompaniment MIDI ingest (whitelist)', () => {
  it('extracts required rhythm/voicing fields; invents no section/energy labels', () => {
    const ppq = 480;
    // C major triad broken: C4+G4 on beat0, E4 on beat2, G4 on beat3. Beat1 = rest.
    const body = [
      ...vlq(0), 0xff, 0x51, 0x03, 0x0a, 0x2c, 0x2a, // tempo ≈ 66 BPM (909090 µs)
      ...vlq(0), 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, // 4/4
      ...on(0, 60, 90),
      ...on(0, 67, 70),
      ...off(ppq * 2, 60),
      ...off(0, 67),
      ...on(0, 64, 75),
      ...off(ppq, 64),
      ...on(0, 67, 65),
      ...off(ppq, 67),
      ...END_OF_TRACK,
    ];
    const song = parseSmf(buildSmf(ppq, [body]));
    expect(song.tempos.length).toBeGreaterThan(0);
    expect(song.timeSignatures[0]?.numerator).toBe(4);

    const { pattern, report } = relativizeSmf(song, balladEntry(), () => '2026-08-13T00:00:00.000Z');
    expect(report.problems).toEqual([]);
    expect(pattern).not.toBeNull();
    expect(report.nonChordTonesExcluded).toBe(0);

    const summary = extractPatternSummary(pattern!);
    expect(summary.meter).toEqual({ beatsPerBar: 4, beatUnit: 4 });
    expect(summary.patternLengthBeats).toBe(4);
    expect(summary.uniqueOnsets.length).toBeGreaterThanOrEqual(3);
    expect(summary.restBeats).toContain(1);
    expect(summary.maxPolyphony).toBeGreaterThanOrEqual(2);
    expect(summary.meanDurationBeats).toBeGreaterThan(0);
    expect(summary.meanVelocityRatio).toBeGreaterThan(0);
    expect(summary.chordToneRoles).toEqual([0, 1, 2]);
    expect(summary.arpeggioOrders[0]).toEqual([0, 2]); // C then G at onset 0

    // Blacklist: pattern must not carry section / energy / emotion / genre fields.
    expect(pattern as unknown as Record<string, unknown>).not.toHaveProperty('sectionRole');
    expect(pattern as unknown as Record<string, unknown>).not.toHaveProperty('energy');
    expect(pattern as unknown as Record<string, unknown>).not.toHaveProperty('emotion');
    expect(pattern as unknown as Record<string, unknown>).not.toHaveProperty('genre');
  });
});
