import { humanizeGain, timingSway } from '@/lib/groove/humanize';
import { getPianoPattern } from '@/lib/groove/pianoPatterns';
import type {
  BeatStrike,
  ChordTimelineEvent,
  CompStroke,
  NoteStrike,
  PianoCompileInput,
  PianoGridLayer,
  PianoPart,
} from '@/lib/groove/types';
import type { AccompanimentPattern } from '@/types';

const BASS_MIDI_THRESHOLD = 48;

export function framesPerBeat(bpm: number, sampleRate: number): number {
  return (sampleRate * 60) / bpm;
}

function foldBeat(beat: number, totalBeats: number): number {
  if (totalBeats <= 0) return beat;
  let b = beat % totalBeats;
  if (b < 0) b += totalBeats;
  return b;
}

function notesAt(events: ChordTimelineEvent[], totalBeats: number, beat: number): number[] {
  const b = foldBeat(beat, totalBeats);
  for (const e of events) {
    if (b >= e.startBeat && b < e.startBeat + e.lengthBeats) return e.midiNotes;
  }
  return [];
}

function velAt(events: ChordTimelineEvent[], totalBeats: number, beat: number): number {
  const b = foldBeat(beat, totalBeats);
  for (const e of events) {
    if (b >= e.startBeat && b < e.startBeat + e.lengthBeats) return e.velocity / 127;
  }
  return 100 / 127;
}

function beatsUntilChordChange(
  events: ChordTimelineEvent[],
  totalBeats: number,
  after: number,
): number {
  if (totalBeats <= 0) return Number.POSITIVE_INFINITY;
  const iterBase = Math.floor(after / totalBeats) * totalBeats;
  let best = Number.POSITIVE_INFINITY;
  for (const e of events) {
    for (const cand of [iterBase + e.startBeat, iterBase + totalBeats + e.startBeat]) {
      if (cand > after + 1e-6) best = Math.min(best, cand - after);
    }
  }
  return best;
}

function ringCap(
  events: ChordTimelineEvent[],
  totalBeats: number,
  onset: number,
  look: number,
  nominal: number,
): number {
  const until = beatsUntilChordChange(events, totalBeats, onset + look);
  return Math.max(0.05, Math.min(nominal, look + until + 0.06));
}

function selectNotes(notes: number[], part: PianoPart): number[] {
  if (part === 'bass') return notes.filter((n) => n < BASS_MIDI_THRESHOLD);
  if (part === 'body') return notes.filter((n) => n >= BASS_MIDI_THRESHOLD);
  return notes;
}

export type PianoBeatCompileInput = {
  totalBeats: number;
  events: ChordTimelineEvent[];
  patternId: AccompanimentPattern;
  /** Used only for strum offsets (seconds → beats via bpm). */
  bpm: number;
};

/**
 * Compile one loop of piano accompaniment as beat-level strikes (SR-independent).
 * This is what JS sends to Native over the bridge.
 */
export function compilePianoBeatStrikes(input: PianoBeatCompileInput): BeatStrike[] {
  const { totalBeats, events, patternId, bpm } = input;
  if (totalBeats <= 0 || events.length === 0 || bpm <= 0) return [];

  const pattern = getPianoPattern(patternId);
  const out: BeatStrike[] = [];
  const secondsPerBeat = 60 / bpm;

  const emitGroup = (opts: {
    onsetBeat: number;
    look: number;
    baseVel: number;
    nominalRing: number;
    strumSec: number;
    sparkle: boolean;
    part: PianoPart;
    timingAmount: number;
    velAmount: number;
  }) => {
    const notes = selectNotes(
      notesAt(events, totalBeats, opts.onsetBeat + opts.look),
      opts.part,
    ).sort((a, b) => a - b);
    if (notes.length === 0) return;

    const ringB = ringCap(events, totalBeats, opts.onsetBeat, opts.look, opts.nominalRing);
    const vGain = velAt(events, totalBeats, opts.onsetBeat + opts.look);
    const sway = timingSway(opts.onsetBeat + opts.look, opts.timingAmount);
    const startBeat0 = opts.onsetBeat + sway;
    const strumBeats = opts.strumSec / secondsPerBeat;

    let voiced = notes;
    const top12 = (notes[notes.length - 1] ?? 0) + 12;
    if (opts.sparkle) voiced = [...notes, top12];

    for (let i = 0; i < voiced.length; i++) {
      const note = voiced[i];
      const startBeat = startBeat0 + i * strumBeats;
      if (startBeat < -1e-9 || startBeat >= totalBeats - 1e-9) continue;
      const durationBeats = Math.min(ringB, totalBeats - Math.max(0, startBeat));
      if (durationBeats <= 0) continue;
      const vv = opts.sparkle && note === top12 ? opts.baseVel * 0.5 : opts.baseVel;
      const gain = humanizeGain(vv, opts.onsetBeat + note, opts.velAmount) * vGain;
      out.push({ startBeat: Math.max(0, startBeat), durationBeats, note, gain });
    }
  };

  const emitGrid = (layer: PianoGridLayer) => {
    const barCount = Math.max(1, Math.ceil(totalBeats / 4 - 1e-9));
    for (let bi = 0; bi < barCount; bi++) {
      for (const st of layer.strokes) {
        const onsetBeat = bi * 4 + st.beat;
        if (onsetBeat >= totalBeats - 1e-9) continue;
        emitGroup({
          onsetBeat,
          look: st.look ?? 0,
          baseVel: st.vel,
          nominalRing: layer.nominalRingBeats,
          strumSec: layer.strumSec,
          sparkle: layer.sparkle,
          part: layer.part,
          timingAmount: layer.timingAmountBeats,
          velAmount: layer.velAmount,
        });
      }
    }
  };

  if (pattern.mode === 'block') {
    for (const e of events) {
      emitGroup({
        onsetBeat: e.startBeat,
        look: 0,
        baseVel: 0.92,
        nominalRing: e.lengthBeats,
        strumSec: 0.012,
        sparkle: true,
        part: 'all',
        timingAmount: 0,
        velAmount: 0.02,
      });
    }
    return out;
  }

  if (pattern.mode === 'arpeggio') {
    for (const e of events) {
      emitGroup({
        onsetBeat: e.startBeat,
        look: 0,
        baseVel: 0.8,
        nominalRing: e.lengthBeats,
        strumSec: 0,
        sparkle: false,
        part: 'bass',
        timingAmount: 0,
        velAmount: 0.07,
      });
    }
    const step = 0.25;
    const order = [0, 1, 2, 3, 4, 2];
    let stepIndex = 0;
    while (true) {
      const onsetBeat = stepIndex * step;
      if (onsetBeat >= totalBeats - 1e-9) break;
      const body = selectNotes(notesAt(events, totalBeats, onsetBeat), 'body').sort((a, b) => a - b);
      if (body.length > 0) {
        const ringB = ringCap(events, totalBeats, onsetBeat, 0, 1.3);
        const pick = order[((stepIndex % order.length) + order.length) % order.length];
        const note = body[pick % body.length];
        const onQuarter = stepIndex % 4 === 0;
        const onEighth = stepIndex % 2 === 0;
        const baseVel = onQuarter ? 0.85 : onEighth ? 0.66 : 0.74;
        const durationBeats = Math.min(ringB, totalBeats - onsetBeat);
        if (durationBeats > 0) {
          const gain =
            humanizeGain(baseVel, onsetBeat + note) * velAt(events, totalBeats, onsetBeat);
          out.push({ startBeat: onsetBeat, durationBeats, note, gain });
        }
      }
      stepIndex += 1;
    }
    return out;
  }

  for (const layer of pattern.grids ?? []) emitGrid(layer);
  return out;
}

/** Convert beat strikes → frame strikes (tests / offline helpers). */
export function beatStrikesToFrames(
  strikes: BeatStrike[],
  bpm: number,
  sampleRate: number,
  totalBeats: number,
): NoteStrike[] {
  const fpb = framesPerBeat(bpm, sampleRate);
  const loopFrames = Math.round(totalBeats * fpb);
  const out: NoteStrike[] = [];
  for (const s of strikes) {
    const start = Math.round(s.startBeat * fpb);
    if (start < 0 || start >= loopFrames) continue;
    const dur = Math.min(Math.max(1, Math.round(s.durationBeats * fpb)), loopFrames - start);
    if (dur <= 0) continue;
    out.push({
      startFrame: start,
      durationFrames: dur,
      note: s.note,
      gain: s.gain,
    });
  }
  return out;
}

/** Frame-level compile (convenience wrapper for tests). */
export function compilePianoStrikes(input: PianoCompileInput): NoteStrike[] {
  const beats = compilePianoBeatStrikes({
    totalBeats: input.totalBeats,
    events: input.events,
    patternId: input.patternId,
    bpm: input.bpm,
  });
  return beatStrikesToFrames(beats, input.bpm, input.sampleRate, input.totalBeats);
}

/** Beat onsets (pre-sway) for a grid pattern — useful for structural tests. */
export function gridOnsetBeats(
  patternId: 'eightBeat' | 'sixteenthBeat',
  totalBeats: number,
  part: PianoPart,
): CompStroke[] {
  const pattern = getPianoPattern(patternId);
  const layer = pattern.grids?.find((g) => g.part === part);
  if (!layer) return [];
  const barCount = Math.max(1, Math.ceil(totalBeats / 4 - 1e-9));
  const out: CompStroke[] = [];
  for (let bi = 0; bi < barCount; bi++) {
    for (const st of layer.strokes) {
      const onsetBeat = bi * 4 + st.beat;
      if (onsetBeat >= totalBeats - 1e-9) continue;
      out.push({ beat: onsetBeat, vel: st.vel, look: st.look });
    }
  }
  return out;
}
