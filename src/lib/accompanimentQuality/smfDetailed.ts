/**
 * Offline SMF reader for POP909 inspection / feature extraction.
 * Extends the ingest parser with track names and key signatures.
 * Not on the app render path. Raw MIDI never ships in the bundle.
 */

import { parseSmf, type SmfNote, type SmfSong } from '@/lib/performance/library/ingest/smf';

export type SmfKeySignature = {
  tick: number;
  /** Sharps (positive) or flats (negative), two's complement nibble. */
  sharps: number;
  /** 0 = major, 1 = minor. */
  minor: number;
};

export type SmfDetailed = SmfSong & {
  trackCount: number;
  trackNames: string[];
  /** Absolute final event tick for every track, including End-of-Track meta. */
  trackEndTicks: number[];
  keySignatures: SmfKeySignature[];
};

class ByteReader {
  private pos = 0;
  constructor(private readonly bytes: Uint8Array) {}
  get offset(): number {
    return this.pos;
  }
  get remaining(): number {
    return this.bytes.length - this.pos;
  }
  u8(): number {
    if (this.pos >= this.bytes.length) throw new Error('unexpected end of file');
    return this.bytes[this.pos++];
  }
  peek(): number {
    if (this.pos >= this.bytes.length) throw new Error('unexpected end of file');
    return this.bytes[this.pos];
  }
  u16(): number {
    return (this.u8() << 8) | this.u8();
  }
  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }
  ascii(n: number): string {
    let s = '';
    for (let i = 0; i < n; i += 1) s += String.fromCharCode(this.u8());
    return s;
  }
  bytesOf(n: number): Uint8Array {
    if (this.pos + n > this.bytes.length) throw new Error('unexpected end of file');
    const slice = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }
  skip(n: number): void {
    if (this.pos + n > this.bytes.length) throw new Error('unexpected end of file');
    this.pos += n;
  }
  varLen(): number {
    let value = 0;
    for (let i = 0; i < 4; i += 1) {
      const b = this.u8();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return value;
    }
    throw new Error('variable-length quantity longer than 4 bytes');
  }
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').trim();
  } catch {
    return Array.from(bytes)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ''))
      .join('')
      .trim();
  }
}

function signed7(n: number): number {
  return n > 127 ? n - 256 : n;
}

/**
 * Same notes/tempo/CC as {@link parseSmf}, plus track names and key signatures
 * needed to identify the POP909 PIANO track and local key.
 */
export function parseSmfDetailed(bytes: Uint8Array): SmfDetailed {
  const base = parseSmf(bytes);
  const r = new ByteReader(bytes);
  if (r.ascii(4) !== 'MThd') throw new Error('not an SMF file (missing MThd)');
  const headerLen = r.u32();
  r.u16();
  const trackCount = r.u16();
  r.u16();
  r.skip(headerLen - 6);

  const trackNames: string[] = Array.from({ length: trackCount }, () => '');
  const trackEndTicks: number[] = Array.from({ length: trackCount }, () => 0);
  const keySignatures: SmfKeySignature[] = [];

  for (let track = 0; track < trackCount; track += 1) {
    if (r.remaining === 0) break;
    if (r.ascii(4) !== 'MTrk') throw new Error(`track ${track}: missing MTrk`);
    const trackLen = r.u32();
    const trackEnd = r.offset + trackLen;
    let tick = 0;
    let runningStatus = 0;

    while (r.offset < trackEnd) {
      tick += r.varLen();
      let status = r.peek();
      if (status & 0x80) {
        status = r.u8();
      } else if (runningStatus & 0x80) {
        status = runningStatus;
      } else {
        throw new Error(`track ${track}: data byte without a running status`);
      }

      if (status === 0xff) {
        const type = r.u8();
        const len = r.varLen();
        const data = r.bytesOf(len);
        if ((type === 0x03 || type === 0x04) && !trackNames[track]) {
          trackNames[track] = decodeText(data);
        } else if (type === 0x59 && len >= 2) {
          keySignatures.push({ tick, sharps: signed7(data[0]), minor: data[1] });
        }
        runningStatus = 0;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        r.skip(r.varLen());
        runningStatus = 0;
        continue;
      }
      runningStatus = status;
      const kind = status & 0xf0;
      if (kind === 0xc0 || kind === 0xd0) r.skip(1);
      else r.skip(2);
    }
    trackEndTicks[track] = tick;
  }

  return { ...base, trackCount, trackNames, trackEndTicks, keySignatures };
}

export function notesOnTrack(song: SmfDetailed, track: number): SmfNote[] {
  return song.notes.filter((n) => n.track === track);
}

export function tickToBeat(tick: number, ppq: number): number {
  return tick / ppq;
}
