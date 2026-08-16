/**
 * Unit tests for GMD drum Humanize statistics (no filesystem / no real MIDI).
 */

import { gmdVoiceOf } from '@/lib/performance/humanize/gmdDrumMap';
import {
  buildGmdDrumProfile,
  extractHits,
  parseGmdInfoCsv,
  type GmdFileInput,
} from '@/lib/performance/humanize/gmdStats';
import { parseSmf } from '@/lib/performance/library/ingest/smf';

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

function buildSmf(ppq: number, trackBody: number[]): Uint8Array {
  const bytes: number[] = [
    0x4d, 0x54, 0x68, 0x64, ...u32(6),
    0x00, 0x00,
    0x00, 0x01,
    (ppq >> 8) & 0xff, ppq & 0xff,
    0x4d, 0x54, 0x72, 0x6b, ...u32(trackBody.length), ...trackBody,
  ];
  return Uint8Array.from(bytes);
}

const on = (delta: number, pitch: number, vel: number) => [...vlq(delta), 0x90, pitch, vel];
const off = (delta: number, pitch: number) => [...vlq(delta), 0x80, pitch, 0x40];

describe('gmdVoiceOf', () => {
  it('maps Roland TD-11 paper pitches', () => {
    expect(gmdVoiceOf(36)).toBe('kick');
    expect(gmdVoiceOf(38)).toBe('snare');
    expect(gmdVoiceOf(42)).toBe('hatClosed');
    expect(gmdVoiceOf(46)).toBe('hatOpen');
    expect(gmdVoiceOf(99)).toBe('other');
  });
});

describe('parseGmdInfoCsv', () => {
  it('parses the official header including session/audio columns', () => {
    const csv = [
      'drummer,session,id,style,bpm,beat_type,time_signature,midi_filename,audio_filename,duration,split',
      'drummer1,drummer1/eval_session,drummer1/eval_session/1,funk/groove1,138,beat,4-4,drummer1/a.mid,drummer1/a.wav,27.8,test',
      'drummer2,drummer2/session1,drummer2/session1/1,rock,90,fill,4-4,drummer2/b.mid,,12.0,train',
    ].join('\n');
    const rows = parseGmdInfoCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].style).toBe('funk/groove1');
    expect(rows[0].bpm).toBe(138);
    expect(rows[0].beatType).toBe('beat');
    expect(rows[0].midiFilename).toBe('drummer1/a.mid');
    expect(rows[1].beatType).toBe('fill');
    expect(rows[1].split).toBe('train');
  });
});

describe('extractHits + buildGmdDrumProfile', () => {
  const ppq = 480;
  // Kick on grid (tick 0), snare slightly late (+24 ticks = +0.05 beat), ghost hat.
  const body = [
    ...on(0, 36, 100),
    ...off(60, 36),
    ...on(60, 38, 90), // at tick 120 = 0.25 beat (exact 16th)
    ...off(60, 38),
    ...on(0, 42, 30), // ghost closed hat same time
    ...off(60, 42),
    ...on(24, 38, 80), // at tick 204 vs nearest 16th 0.5→240 → early-ish; wait:
    // cumulative: after off at +60 from previous on at 120 → tick 180, then +24 = 204
    // nearest 16th: 0.5 beat = 240, signed = 204/480 - 0.5 = -0.075
    ...off(60, 38),
    0x00, 0xff, 0x2f, 0x00,
  ];
  const bytes = buildSmf(ppq, body);

  it('extracts voice-mapped timing deviations against a 16th grid', () => {
    const song = parseSmf(bytes);
    const hits = extractHits(song, 120);
    expect(hits.length).toBe(4);
    const kick = hits.find((h) => h.voice === 'kick');
    expect(kick?.absDevBeats).toBeCloseTo(0, 6);
    expect(hits.filter((h) => h.velocity <= 40)).toHaveLength(1);
  });

  it('aggregates measured profile with tempo bins and style keys', () => {
    const infoBase = {
      drummer: 'drummer1',
      id: 't1',
      style: 'rock/groove1',
      bpm: 90,
      beatType: 'beat',
      timeSignature: '4-4',
      midiFilename: 'x.mid',
      split: 'train',
      duration: 1,
    };
    const files: GmdFileInput[] = [
      { info: { ...infoBase }, bytes },
      {
        info: { ...infoBase, id: 't2', style: 'funk', bpm: 130, beatType: 'fill' },
        bytes,
      },
      {
        info: { ...infoBase, id: 't3', bpm: 90 },
        bytes: Uint8Array.from([1, 2, 3, 4]), // force parse failure
      },
    ];
    const profile = buildGmdDrumProfile(files, () => '2026-08-03T00:00:00.000Z');
    expect(profile.dataClass).toBe('measured');
    expect(profile.profileVersion).toBe('gmd-drum-v1');
    expect(profile.source.license).toBe('CC BY 4.0');
    expect(profile.analysis.filesParsed).toBe(2);
    expect(profile.analysis.filesFailed).toBe(1);
    expect(profile.analysis.totalHits).toBe(8);
    expect(profile.overall.fillFileRate).toBeCloseTo(0.5, 6);
    expect(profile.overall.byVoice.kick?.velocity.count).toBe(2);
    expect(profile.overall.byVoice.hatClosed?.velocity.ghostRate).toBeGreaterThan(0);
    expect(profile.byPrimaryStyle.rock?.fileCount).toBe(1);
    expect(profile.byPrimaryStyle.funk?.fileCount).toBe(1);
    const bin90 = profile.byTempoBin.find((b) => b.bin.label === '80-100');
    expect(bin90?.fileCount).toBe(1);
    const bin130 = profile.byTempoBin.find((b) => b.bin.label === '120-140');
    expect(bin130?.fillFileCount).toBe(1);
  });
});
