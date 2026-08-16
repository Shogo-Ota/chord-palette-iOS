/**
 * Dependency-free diagnostic WAV renderer.
 *
 * This is deliberately not a product instrument or a sound-quality reference. It
 * gives Teacher and retargeted Final MIDI the exact same neutral sound so a listener
 * without a DAW can compare harmony, register, timing, duration and velocity.
 */

import type { FinalMidiControlChange, FinalMidiNote, FinalMidiSnapshot } from '@/lib/midiExport';

const SAMPLE_RATE = 22_050;
const RELEASE_SECONDS = 0.35;

function secondsPerBeat(snapshot: FinalMidiSnapshot): number {
  return 60 / snapshot.bpm;
}

function pedalDownAt(changes: readonly FinalMidiControlChange[], beat: number): boolean {
  let down = false;
  for (const change of changes) {
    if (change.controller !== 64 || change.startBeat > beat) continue;
    down = change.value >= 64;
  }
  return down;
}

function effectiveEndBeat(note: FinalMidiNote, snapshot: FinalMidiSnapshot): number {
  const naturalEnd = note.startBeat + note.durationBeat;
  const pedal = snapshot.controlChanges
    .filter((change) => change.controller === 64 && change.channel === note.channel)
    .sort((left, right) => left.startBeat - right.startBeat);
  if (!pedalDownAt(pedal, naturalEnd)) return naturalEnd;
  const up = pedal.find((change) => change.startBeat > naturalEnd && change.value < 64);
  return Math.min(up?.startBeat ?? snapshot.totalBeats, snapshot.totalBeats);
}

function midiFrequency(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

function renderNote(mix: Float32Array, note: FinalMidiNote, snapshot: FinalMidiSnapshot): void {
  if (note.track !== 'accompaniment') return;
  const beatSeconds = secondsPerBeat(snapshot);
  const startSeconds = note.startBeat * beatSeconds;
  const endSeconds = effectiveEndBeat(note, snapshot) * beatSeconds;
  const startSample = Math.max(0, Math.floor(startSeconds * SAMPLE_RATE));
  const endSample = Math.min(mix.length, Math.ceil((endSeconds + RELEASE_SECONDS) * SAMPLE_RATE));
  const frequency = midiFrequency(note.pitch);
  const velocity = (note.velocity / 127) ** 1.35;

  for (let sample = startSample; sample < endSample; sample++) {
    const absoluteSeconds = sample / SAMPLE_RATE;
    const localSeconds = absoluteSeconds - startSeconds;
    const releaseSeconds = Math.max(0, absoluteSeconds - endSeconds);
    const attack = Math.min(1, localSeconds / 0.008);
    const body = 0.42 + 0.58 * Math.exp(-1.6 * localSeconds);
    const release = releaseSeconds === 0 ? 1 : Math.exp((-6 * releaseSeconds) / RELEASE_SECONDS);
    const phase = 2 * Math.PI * frequency * localSeconds;
    const tone = Math.sin(phase) + 0.32 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
    mix[sample] += 0.075 * velocity * attack * body * release * (tone / 1.44);
  }
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function encodeMonoPcm16(samples: Float32Array): Uint8Array {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0.92 ? 0.92 / peak : 1;
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample * scale));
    view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}

export function renderDiagnosticPreviewWav(snapshot: FinalMidiSnapshot): Uint8Array {
  const durationSeconds = snapshot.totalBeats * secondsPerBeat(snapshot) + RELEASE_SECONDS + 0.1;
  const mix = new Float32Array(Math.ceil(durationSeconds * SAMPLE_RATE));
  for (const note of snapshot.notes) renderNote(mix, note, snapshot);
  return encodeMonoPcm16(mix);
}
