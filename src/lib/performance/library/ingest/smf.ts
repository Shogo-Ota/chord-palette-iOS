/**
 * Minimal Standard MIDI File (SMF) reader for the teacher-pattern ingest
 * pipeline (docs/midi_dataset_policy.md).
 *
 * Pure — operates on a byte array, no filesystem, no external dependency. It
 * extracts only what relativization needs: paired notes (tick, pitch,
 * velocity, duration), tempo and time-signature meta events, and the pulses
 * per quarter note. Everything else (sysex, controllers, program changes) is
 * skipped structurally so malformed musical content cannot crash the reader.
 *
 * Deliberately NOT on the render path: used by tests and the ingest generator
 * only. Raw MIDI is never bundled into the app (policy rule 3).
 */

/** One paired note. `tick` and `durTicks` are in SMF ticks (see `ppq`). */
export interface SmfNote {
  tick: number;
  pitch: number;
  velocity: number;
  durTicks: number;
  channel: number;
  track: number;
}

export interface SmfTempo {
  tick: number;
  usPerQuarter: number;
}

export interface SmfTimeSignature {
  tick: number;
  numerator: number;
  /** Actual denominator (meta stores log2; this is 2^dd). */
  denominator: number;
}

export interface SmfSong {
  format: number;
  /** Pulses (ticks) per quarter note. */
  ppq: number;
  notes: SmfNote[];
  tempos: SmfTempo[];
  timeSignatures: SmfTimeSignature[];
  /** Non-fatal oddities found while reading (e.g. unterminated notes). */
  warnings: string[];
}

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
    // >>> 0 keeps the value unsigned when the top bit is set.
    return (((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0);
  }

  ascii(n: number): string {
    let s = '';
    for (let i = 0; i < n; i += 1) s += String.fromCharCode(this.u8());
    return s;
  }

  skip(n: number): void {
    if (this.pos + n > this.bytes.length) throw new Error('unexpected end of file');
    this.pos += n;
  }

  /** SMF variable-length quantity (7 bits per byte, MSB = continuation). */
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

/** Data byte count for a channel message, by high nibble of the status byte. */
function channelDataBytes(status: number): number {
  const kind = status & 0xf0;
  // Program change (0xC0) and channel aftertouch (0xD0) carry one data byte.
  return kind === 0xc0 || kind === 0xd0 ? 1 : 2;
}

/**
 * Parse an SMF file. Throws with a descriptive message on structural problems
 * (bad header, SMPTE division, truncation); musical oddities become warnings.
 */
export function parseSmf(bytes: Uint8Array): SmfSong {
  const r = new ByteReader(bytes);
  if (r.ascii(4) !== 'MThd') throw new Error('not an SMF file (missing MThd)');
  const headerLen = r.u32();
  if (headerLen < 6) throw new Error(`MThd length ${headerLen} < 6`);
  const format = r.u16();
  const trackCount = r.u16();
  const division = r.u16();
  r.skip(headerLen - 6);
  if ((division & 0x8000) !== 0) {
    throw new Error('SMPTE time division is not supported (metrical PPQ only)');
  }
  const ppq = division;
  if (ppq <= 0) throw new Error(`invalid PPQ ${ppq}`);

  const notes: SmfNote[] = [];
  const tempos: SmfTempo[] = [];
  const timeSignatures: SmfTimeSignature[] = [];
  const warnings: string[] = [];

  for (let track = 0; track < trackCount; track += 1) {
    if (r.remaining === 0) {
      warnings.push(`header declares ${trackCount} tracks but file ends after ${track}`);
      break;
    }
    if (r.ascii(4) !== 'MTrk') throw new Error(`track ${track}: missing MTrk`);
    const trackLen = r.u32();
    const trackEnd = r.offset + trackLen;

    let tick = 0;
    let runningStatus = 0;
    // Note-ons waiting for their offs, keyed by channel<<8|pitch (FIFO per key).
    const open = new Map<number, { tick: number; velocity: number }[]>();

    const closeNote = (channel: number, pitch: number, offTick: number): void => {
      const key = (channel << 8) | pitch;
      const queue = open.get(key);
      const started = queue?.shift();
      if (!started) return; // stray note-off — ignore
      notes.push({
        tick: started.tick,
        pitch,
        velocity: started.velocity,
        durTicks: Math.max(1, offTick - started.tick),
        channel,
        track,
      });
    };

    while (r.offset < trackEnd) {
      tick += r.varLen();
      let status = r.peek();
      if (status & 0x80) {
        status = r.u8();
      } else if (runningStatus & 0x80) {
        status = runningStatus; // running status: reuse, data byte stays in stream
      } else {
        throw new Error(`track ${track}: data byte without a running status`);
      }

      if (status === 0xff) {
        const type = r.u8();
        const len = r.varLen();
        if (type === 0x51 && len === 3) {
          tempos.push({ tick, usPerQuarter: (r.u8() << 16) | (r.u8() << 8) | r.u8() });
        } else if (type === 0x58 && len >= 2) {
          const numerator = r.u8();
          const dd = r.u8();
          r.skip(len - 2);
          timeSignatures.push({ tick, numerator, denominator: 2 ** dd });
        } else {
          r.skip(len);
        }
        runningStatus = 0; // meta events cancel running status
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        r.skip(r.varLen());
        runningStatus = 0;
        continue;
      }

      runningStatus = status;
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      if (kind === 0x90) {
        const pitch = r.u8();
        const velocity = r.u8();
        if (velocity > 0) {
          const key = (channel << 8) | pitch;
          const queue = open.get(key) ?? [];
          queue.push({ tick, velocity });
          open.set(key, queue);
        } else {
          closeNote(channel, pitch, tick); // note-on velocity 0 == note-off
        }
      } else if (kind === 0x80) {
        const pitch = r.u8();
        r.skip(1); // release velocity
        closeNote(channel, pitch, tick);
      } else {
        r.skip(channelDataBytes(status));
      }
    }

    // Unterminated notes: close at the track's final tick so material is not
    // silently lost, but flag it — a healthy teacher file should never do this.
    let hanging = 0;
    for (const [key, queue] of open) {
      for (const started of queue) {
        hanging += 1;
        notes.push({
          tick: started.tick,
          pitch: key & 0xff,
          velocity: started.velocity,
          durTicks: Math.max(1, tick - started.tick),
          channel: key >> 8,
          track,
        });
      }
    }
    if (hanging > 0) warnings.push(`track ${track}: ${hanging} note(s) had no note-off`);
  }

  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
  return { format, ppq, notes, tempos, timeSignatures, warnings };
}
