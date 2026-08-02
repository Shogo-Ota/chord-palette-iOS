import { getBassPattern } from '@/lib/groove/bassPatterns';
import { humanizeGain, timingSway } from '@/lib/groove/humanize';
import { getPianoPattern } from '@/lib/groove/pianoPatterns';
import type {
  BeatStrike,
  ChordTimelineEvent,
  CompStroke,
  GrooveFeatures,
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

/** Move straight off-eighths toward `swingRatio` (0.5 = straight, 2/3 = triplet swing). */
export function applySwingToBeat(beat: number, swingRatio: number): number {
  if (swingRatio <= 0.5 + 1e-9) return beat;
  const beatFloor = Math.floor(beat);
  const frac = beat - beatFloor;
  if (Math.abs(frac - 0.5) < 0.05) return beatFloor + swingRatio;
  return beat;
}

function accentMultiplier(features: GrooveFeatures | undefined, beatInBar: number): number {
  const accents = features?.velocityAccent;
  if (!accents || accents.length === 0) return 1;
  const slot = Math.min(accents.length - 1, Math.max(0, Math.floor(beatInBar)));
  return accents[slot] ?? 1;
}

function ghostScale(features: GrooveFeatures | undefined, vel: number): number {
  const density = features?.ghostDensity ?? 0;
  if (density <= 0 || vel >= 0.6) return vel;
  return Math.max(0.05, vel * (1 - density * 0.5));
}

export type PianoBeatCompileInput = {
  totalBeats: number;
  events: ChordTimelineEvent[];
  patternId: AccompanimentPattern;
  /** Used only for strum offsets (seconds → beats via bpm). */
  bpm: number;
  /** Optional GrooveProfile features (humanize / swing / strum / ghost). */
  features?: GrooveFeatures;
  /** Optional independent bass PatternDoc id (default locked-quarters). */
  bassPatternId?: string;
};

/**
 * Compile one loop of piano accompaniment as beat-level strikes (SR-independent).
 * This is what JS sends to Native over the bridge.
 */
export function compilePianoBeatStrikes(input: PianoBeatCompileInput): BeatStrike[] {
  const { totalBeats, events, patternId, bpm, features, bassPatternId } = input;
  if (totalBeats <= 0 || events.length === 0 || bpm <= 0) return [];

  const pattern = getPianoPattern(patternId);
  const out: BeatStrike[] = [];
  const secondsPerBeat = 60 / bpm;
  // Swing.md: do not apply 8th-swing onto 16th grids (avoids flam artifacts).
  const swingRatio =
    patternId === 'sixteenthBeat' ? 0.5 : (features?.swingRatio ?? 0.5);
  const timingBias = features?.timingBiasBeats ?? 0;

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
    const swungOnset = applySwingToBeat(opts.onsetBeat, swingRatio) + timingBias;
    const notes = selectNotes(
      notesAt(events, totalBeats, swungOnset + opts.look),
      opts.part,
    ).sort((a, b) => a - b);
    if (notes.length === 0) return;

    const ringB = ringCap(events, totalBeats, swungOnset, opts.look, opts.nominalRing);
    const vGain = velAt(events, totalBeats, swungOnset + opts.look);
    const sway = timingSway(swungOnset + opts.look, opts.timingAmount);
    const startBeat0 = swungOnset + sway;
    const strumBeats = opts.strumSec / secondsPerBeat;
    const accent = accentMultiplier(features, foldBeat(opts.onsetBeat, 4));

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
      const gain =
        humanizeGain(vv * accent, opts.onsetBeat + note, opts.velAmount) * vGain;
      out.push({ startBeat: Math.max(0, startBeat), durationBeats, note, gain });
    }
  };

  const resolveBodyHumanize = (layer: PianoGridLayer) => ({
    timingAmount: features?.humanize.timingAmountBeats ?? layer.timingAmountBeats,
    velAmount: features?.humanize.velocityAmount ?? layer.velAmount,
    strumSec: features != null ? features.strumMs / 1000 : layer.strumSec,
  });

  const emitGrid = (layer: PianoGridLayer) => {
    const isBass = layer.part === 'bass';
    // G2: only override when an explicit bassPatternId is provided.
    const bassDoc =
      isBass && bassPatternId != null && bassPatternId !== ''
        ? getBassPattern(bassPatternId)
        : null;
    const strokes = bassDoc?.strokes ?? layer.strokes;
    const nominalRing = bassDoc?.nominalRingBeats ?? layer.nominalRingBeats;
    const bodyH = resolveBodyHumanize(layer);
    const timingAmount = isBass
      ? (bassDoc?.timingAmountBeats ?? layer.timingAmountBeats)
      : bodyH.timingAmount;
    const velAmount = isBass ? (bassDoc?.velAmount ?? layer.velAmount) : bodyH.velAmount;
    const strumSec = isBass ? 0 : bodyH.strumSec;

    const barCount = Math.max(1, Math.ceil(totalBeats / 4 - 1e-9));
    for (let bi = 0; bi < barCount; bi++) {
      for (const st of strokes) {
        const onsetBeat = bi * 4 + st.beat;
        if (onsetBeat >= totalBeats - 1e-9) continue;
        const baseVel = ghostScale(features, st.vel);
        emitGroup({
          onsetBeat,
          look: st.look ?? 0,
          baseVel,
          nominalRing,
          strumSec,
          sparkle: isBass ? false : layer.sparkle,
          part: layer.part,
          timingAmount,
          velAmount,
        });
      }
    }
  };

  if (pattern.mode === 'block') {
    const strumSec = features != null ? features.strumMs / 1000 : 0.005;
    const velAmount = features?.humanize.velocityAmount ?? 0.03;
    const timingAmount = features?.humanize.timingAmountBeats ?? 0;
    for (const e of events) {
      emitGroup({
        onsetBeat: e.startBeat,
        look: 0,
        baseVel: 0.72, // GT-001 restrained peak
        nominalRing: e.lengthBeats,
        strumSec,
        sparkle: true,
        part: 'all',
        timingAmount,
        velAmount,
      });
    }
    return out;
  }

  if (pattern.mode === 'arpeggio') {
    const velAmount = features?.humanize.velocityAmount ?? 0.06;
    const timingAmount = features?.humanize.timingAmountBeats ?? 0;
    for (const e of events) {
      emitGroup({
        onsetBeat: e.startBeat,
        look: 0,
        baseVel: 0.62,
        nominalRing: e.lengthBeats,
        strumSec: 0,
        sparkle: false,
        part: 'bass',
        timingAmount: 0,
        velAmount,
      });
    }
    const step = 0.25;
    const order = [0, 1, 2, 3, 4, 2];
    let stepIndex = 0;
    while (true) {
      const onsetBeat = stepIndex * step;
      if (onsetBeat >= totalBeats - 1e-9) break;
      // G4: arpeggio body also receives swing / bias / timing sway.
      const swungOnset = applySwingToBeat(onsetBeat, swingRatio) + timingBias;
      const body = selectNotes(notesAt(events, totalBeats, swungOnset), 'body').sort(
        (a, b) => a - b,
      );
      if (body.length > 0) {
        const ringB = ringCap(events, totalBeats, swungOnset, 0, 1.3);
        const pick = order[((stepIndex % order.length) + order.length) % order.length];
        const note = body[pick % body.length];
        const onQuarter = stepIndex % 4 === 0;
        const onEighth = stepIndex % 2 === 0;
        const baseVel = ghostScale(
          features,
          onQuarter ? 0.62 : onEighth ? 0.54 : 0.56,
        );
        const sway = timingSway(swungOnset + note, timingAmount);
        const startBeat = Math.max(0, swungOnset + sway);
        const durationBeats = Math.min(ringB, totalBeats - startBeat);
        if (durationBeats > 0 && startBeat < totalBeats - 1e-9) {
          const accent = accentMultiplier(features, foldBeat(onsetBeat, 4));
          const gain =
            humanizeGain(baseVel * accent, onsetBeat + note, velAmount) *
            velAt(events, totalBeats, swungOnset);
          out.push({ startBeat, durationBeats, note, gain });
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
    features: input.features,
    bassPatternId: input.bassPatternId,
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
