/**
 * The single conversion point from `FinalMidiSnapshot` to what native realtime
 * playback receives.
 *
 * Why a Standard MIDI File and not a note array: the whole plan crosses the bridge
 * once and native schedules it with Apple's own sequencer, so no JS timer ever touches
 * musical time. It also makes "what you hear is what you export" structural — both
 * consumers read the same snapshot through the same writer, so an onset can only
 * differ if the snapshot differs.
 *
 * The bytes are not byte-identical to the exported file, and deliberately so: playback
 * omits the GM program change (native owns which SoundFont preset is loaded — see
 * `SmfWriteOptions.includeProgramChange`). Everything that carries musical meaning —
 * tempo, time signature, onsets, durations, pitches, velocities, CC64 — is identical.
 *
 * Pure: no RN/Expo/native imports. Playback-engine agnostic — it knows nothing about
 * which Human Template, pattern or chord produced the snapshot, so a newly added
 * template needs no change here.
 */

import { DEFAULT_PPQ, writeSmf } from '@/lib/midiExport/smfWrite';
import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import type { InstrumentId } from '@/types';
import { bytesToBase64 } from './base64';

/** One MIDI message native will schedule. Beat time is the source of truth. */
export type NativeMidiEvent = {
  beat: number;
  /** Note-on, note-off, or control change. */
  kind: 'on' | 'off' | 'cc';
  channel: number;
  /** Pitch (on/off) or controller number (cc). */
  a: number;
  /** Velocity (on/off) or controller value (cc). */
  b: number;
  drum: boolean;
};

export interface NativePlaybackPlan {
  bpm: number;
  /** Loop boundary in beats. */
  totalBeats: number;
  loop: boolean;
  /** Seek on start (beats). Non-zero when re-applying a setting mid-playback. */
  startBeat: number;
  /**
   * The schedule native actually plays. Same pitches / velocities / times / CC64
   * as the snapshot — not a second interpretation. AVAudioSequencer is not used:
   * it was silent on device when created against an already-running engine.
   */
  midiEvents: NativeMidiEvent[];
  /** SMF Format 1, base64. Kept for diagnostics / DAW; not the live schedule. */
  smfBase64: string;
  /** Ticks per quarter note of `smfBase64` — native reads tempo from the file. */
  ppq: number;
  /**
   * Whether the file ends with a drum track. Told rather than guessed: native routes
   * the LAST track to the percussion sampler only when this is true, so the piano can
   * never be sent to the drum bank.
   */
  hasDrums: boolean;
  instrument: InstrumentId;
  /** GM program native must load into the melodic sampler. */
  gmProgram: number;
  /** Expected event counts — the objective check that nothing was dropped. */
  noteOnCount: number;
  controlChangeCount: number;
  /**
   * Stable fingerprint of the musical content. Two playbacks reporting the same
   * signature were fed the same Final MIDI, which is what makes an A/B comparison
   * between the old and new engines meaningful.
   */
  signature: string;
}

export interface NativePlaybackPlanOptions {
  loop?: boolean;
  startBeat?: number;
  ppq?: number;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Canonical text of everything that must sound identical across engines. */
export function snapshotSignature(snapshot: FinalMidiSnapshot): string {
  const notes = snapshot.notes
    .map(
      (n) =>
        `${n.track}:${n.channel}:${n.pitch}:${n.velocity}:${n.startBeat.toFixed(6)}:${n.durationBeat.toFixed(6)}`,
    )
    .sort();
  const ccs = snapshot.controlChanges
    .map((c) => `${c.channel}:${c.controller}:${c.value}:${c.startBeat.toFixed(6)}`)
    .sort();
  return fnv1a(
    [
      `bpm=${snapshot.bpm}`,
      `beats=${snapshot.totalBeats.toFixed(6)}`,
      `sig=${snapshot.timeSignature.numerator}/${snapshot.timeSignature.denominator}`,
      `program=${snapshot.gmProgram}`,
      ...notes,
      ...ccs,
    ].join('|'),
  );
}

function kindOrder(kind: NativeMidiEvent['kind']): number {
  if (kind === 'cc') return 0;
  if (kind === 'off') return 1;
  return 2;
}

/** Flatten the snapshot into the messages native will send the sampler. */
export function snapshotToMidiEvents(snapshot: FinalMidiSnapshot): NativeMidiEvent[] {
  const events: NativeMidiEvent[] = [];
  for (const n of snapshot.notes) {
    const drum = n.track === 'drums';
    events.push({
      beat: n.startBeat,
      kind: 'on',
      channel: n.channel,
      a: n.pitch,
      b: n.velocity,
      drum,
    });
    events.push({
      beat: n.startBeat + n.durationBeat,
      kind: 'off',
      channel: n.channel,
      a: n.pitch,
      b: 0,
      drum,
    });
  }
  for (const c of snapshot.controlChanges) {
    events.push({
      beat: c.startBeat,
      kind: 'cc',
      channel: c.channel,
      a: c.controller,
      b: c.value,
      drum: false,
    });
  }
  return events.sort((x, y) => x.beat - y.beat || kindOrder(x.kind) - kindOrder(y.kind));
}

export function buildNativePlaybackPlan(
  snapshot: FinalMidiSnapshot,
  options: NativePlaybackPlanOptions = {},
): NativePlaybackPlan {
  const ppq = options.ppq ?? DEFAULT_PPQ;
  const bytes = writeSmf(snapshot, ppq, { includeProgramChange: false });
  return {
    bpm: snapshot.bpm,
    totalBeats: snapshot.totalBeats,
    loop: options.loop ?? true,
    startBeat: Math.max(0, options.startBeat ?? 0),
    midiEvents: snapshotToMidiEvents(snapshot),
    smfBase64: bytesToBase64(bytes),
    ppq,
    hasDrums: snapshot.notes.some((n) => n.track === 'drums'),
    instrument: snapshot.instrumentId,
    gmProgram: snapshot.gmProgram,
    noteOnCount: snapshot.notes.length,
    controlChangeCount: snapshot.controlChanges.length,
    signature: snapshotSignature(snapshot),
  };
}
