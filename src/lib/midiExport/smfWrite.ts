/**
 * Standard MIDI File (Format 1) writer for FinalMidiSnapshot.
 * Pure byte output — mirrors the ingest test fixture helpers in smf.ts tests.
 */

import type { FinalMidiSnapshot } from '../performance/finalMidi/types';

export const DEFAULT_PPQ = 480;

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

function beatToTick(beat: number, ppq: number): number {
  return Math.max(0, Math.round(beat * ppq));
}

type TimedEvent = { tick: number; bytes: number[] };

function pushMeta(events: TimedEvent[], tick: number, type: number, data: number[]): void {
  events.push({ tick, bytes: [0xff, type, data.length, ...data] });
}

function pushNoteOn(
  events: TimedEvent[],
  tick: number,
  channel: number,
  pitch: number,
  vel: number,
): void {
  events.push({ tick, bytes: [0x90 | channel, pitch, Math.max(1, Math.min(127, vel))] });
}

function pushNoteOff(events: TimedEvent[], tick: number, channel: number, pitch: number): void {
  events.push({ tick, bytes: [0x80 | channel, pitch, 0x40] });
}

function pushCc(
  events: TimedEvent[],
  tick: number,
  channel: number,
  controller: number,
  value: number,
): void {
  events.push({ tick, bytes: [0xb0 | channel, controller, Math.max(0, Math.min(127, value))] });
}

function flushTrack(events: TimedEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);
  const body: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    body.push(...vlq(ev.tick - lastTick), ...ev.bytes);
    lastTick = ev.tick;
  }
  body.push(0x00, 0xff, 0x2f, 0x00);
  return body;
}

function buildConductorTrack(snapshot: FinalMidiSnapshot, ppq: number): number[] {
  const events: TimedEvent[] = [];
  const usPerQuarter = Math.round(60_000_000 / snapshot.bpm);
  pushMeta(events, 0, 0x51, [
    (usPerQuarter >> 16) & 0xff,
    (usPerQuarter >> 8) & 0xff,
    usPerQuarter & 0xff,
  ]);

  const { numerator, denominator } = snapshot.timeSignature;
  const dd = Math.round(Math.log2(denominator));
  pushMeta(events, 0, 0x58, [numerator, dd, 24, 8]);

  for (const marker of snapshot.markers) {
    const tick = beatToTick(marker.startBeat, ppq);
    const text = Array.from(marker.label).map((c) => c.charCodeAt(0));
    pushMeta(events, tick, 0x06, text);
  }

  return flushTrack(events);
}

function buildAccompanimentTrack(
  snapshot: FinalMidiSnapshot,
  ppq: number,
  options: SmfWriteOptions,
): number[] {
  const events: TimedEvent[] = [];
  if (options.includeProgramChange ?? true) {
    events.push({ tick: 0, bytes: [0xc0, snapshot.gmProgram] });
  }

  for (const cc of snapshot.controlChanges) {
    pushCc(events, beatToTick(cc.startBeat, ppq), cc.channel, cc.controller, cc.value);
  }

  for (const note of snapshot.notes.filter((n) => n.track === 'accompaniment')) {
    const start = beatToTick(note.startBeat, ppq);
    const end = beatToTick(note.startBeat + note.durationBeat, ppq);
    pushNoteOn(events, start, note.channel, note.pitch, note.velocity);
    pushNoteOff(events, Math.max(start + 1, end), note.channel, note.pitch);
  }

  return flushTrack(events);
}

function buildDrumTrack(snapshot: FinalMidiSnapshot, ppq: number): number[] {
  const events: TimedEvent[] = [];
  for (const note of snapshot.notes.filter((n) => n.track === 'drums')) {
    const start = beatToTick(note.startBeat, ppq);
    const end = beatToTick(note.startBeat + note.durationBeat, ppq);
    pushNoteOn(events, start, note.channel, note.pitch, note.velocity);
    pushNoteOff(events, Math.max(start + 1, end), note.channel, note.pitch);
  }
  return flushTrack(events);
}

export type SmfWriteOptions = {
  /**
   * Emit the GM program change at tick 0. A DAW needs it to pick a sound, so the
   * exported file keeps it. Realtime playback does NOT: native loads the SoundFont
   * program itself, and a program change reaching `AVAudioUnitSampler` would select
   * a preset that was never loaded — silence instead of a piano.
   */
  includeProgramChange?: boolean;
};

/**
 * Encode snapshot as SMF Format 1 (.mid bytes).
 * Track 0: tempo, time signature, chord markers.
 * Track 1: accompaniment (program, CC64, notes).
 * Track 2: drums (when present).
 */
export function writeSmf(
  snapshot: FinalMidiSnapshot,
  ppq = DEFAULT_PPQ,
  options: SmfWriteOptions = {},
): Uint8Array {
  const drumNotes = snapshot.notes.some((n) => n.track === 'drums');
  const tracks = [
    buildConductorTrack(snapshot, ppq),
    buildAccompanimentTrack(snapshot, ppq, options),
  ];
  if (drumNotes) tracks.push(buildDrumTrack(snapshot, ppq));

  const bytes: number[] = [
    0x4d,
    0x54,
    0x68,
    0x64,
    ...u32(6),
    0x00,
    0x01,
    (tracks.length >> 8) & 0xff,
    tracks.length & 0xff,
    (ppq >> 8) & 0xff,
    ppq & 0xff,
  ];

  for (const body of tracks) {
    bytes.push(0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body);
  }

  return Uint8Array.from(bytes);
}
