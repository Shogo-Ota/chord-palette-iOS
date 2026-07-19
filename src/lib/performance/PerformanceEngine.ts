/**
 * Performance Engine (sprint-6 §4.3 / design §4). Turns a voice-led progression
 * (Step 1 output) plus a style/groove into a deterministic `NoteEvent[]` — the
 * domain output contract consumed by a Renderer in Step 3.
 *
 * It is a thin orchestrator: each musical concern lives in its own small module
 * (velocity / microtiming / articulation / roundRobin / styles) and this file just
 * composes them in the fixed pipeline order. No native, RN or Expo imports; every
 * random value comes from the seed (never `Math.random`), so the same input always
 * yields byte-identical output.
 */

import { pickArticulation, computeGate } from './articulation';
import { msToBeat, trackOffsetMs } from './microtiming';
import type { NoteEvent, TrackId } from './NoteEvent';
import { RoundRobinPicker } from './roundRobin';
import { streamFor } from './rng';
import { getStyle, type StyleId } from './styles';
import { stepBeat, type StylePreset, type StepPattern } from './styles/types';
import { avoidFiveInARow, computeVelocity } from './velocity';

/** A single voice-led chord placed on the timeline (bass anchored + re-voiced body). */
export interface PerfChord {
  /** Re-voiced chord body notes (MIDI). */
  bodyMidi: number[];
  /** Anchored bass notes (MIDI), lowest → highest. May be empty. */
  bassMidi: number[];
  /** Absolute start beat from the head of the progression. */
  startBeat: number;
  /** Length in beats. */
  durationBeats: number;
}

/** Domain input to the engine — pure data, no service/native types. */
export interface PerformanceInput {
  chords: PerfChord[];
  bpm: number;
  /** Project seed: same seed ⇒ same performance (design §1 / §6). */
  seed: number;
}

export interface PerformanceOptions {
  /** Groove id, or a legacy accompaniment id (`block` | `eightBeat` | …). */
  styleId: StyleId | string;
  /** Emit kick/snare/hat tracks (default true). */
  drums?: boolean;
}

/** General-MIDI-style pitches for the synthesized drum voices. */
const DRUM_PITCH: Record<'kick' | 'snare' | 'hat', number> = {
  kick: 36,
  snare: 38,
  hat: 42,
};

/** One scheduled hit on the grid before humanization. */
interface Strike {
  bar: number;
  step: number;
  gridBeat: number;
  accent: number;
  ghost: boolean;
  pitches: number[];
}

/** A flattened, per-pitch note awaiting velocity/timing/articulation resolution. */
interface NoteDraft {
  bar: number;
  step: number;
  gridBeat: number;
  nominalBeat: number;
  accent: number;
  ghost: boolean;
  pitch: number;
}

const EPSILON = 1e-9;

function totalBeatsOf(chords: PerfChord[]): number {
  return chords.reduce((max, c) => Math.max(max, c.startBeat + c.durationBeats), 0);
}

/** The chord sounding at `beat` (last chord that has started). */
function activeChord(chords: PerfChord[], beat: number): PerfChord | undefined {
  let found: PerfChord | undefined;
  for (const c of chords) {
    if (c.startBeat <= beat + EPSILON) found = c;
    else break;
  }
  return found;
}

/** The bass pitch for a chord: the highest anchored bass note (most audible). */
function bassPitch(chord: PerfChord): number | undefined {
  if (chord.bassMidi.length > 0) return Math.max(...chord.bassMidi);
  if (chord.bodyMidi.length > 0) return Math.min(...chord.bodyMidi) - 12;
  return undefined;
}

/** Collect the raw grid strikes for one track across the whole progression. */
function collectStrikes(
  track: TrackId,
  pattern: StepPattern,
  style: StylePreset,
  chords: PerfChord[],
  bars: number,
  totalBeats: number,
): Strike[] {
  const strikes: Strike[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < style.stepsPerBar; step++) {
      if (!pattern.hits[step]) continue;
      const gridBeat = bar * style.beatsPerBar + stepBeat(style, step);
      if (gridBeat >= totalBeats - EPSILON) continue; // stay inside the progression
      const chord = activeChord(chords, gridBeat);
      if (!chord) continue;

      let pitches: number[];
      if (track === 'chord') pitches = chord.bodyMidi;
      else if (track === 'bass') {
        const p = bassPitch(chord);
        pitches = p === undefined ? [] : [p];
      } else pitches = [DRUM_PITCH[track as 'kick' | 'snare' | 'hat']];

      if (pitches.length === 0) continue;
      strikes.push({
        bar,
        step,
        gridBeat,
        accent: pattern.accent[step] ?? 0.6,
        ghost: pattern.ghost?.[step] ?? false,
        pitches,
      });
    }
  }
  return strikes;
}

/** Flatten strikes to per-pitch drafts, computing the nominal length to the next strike. */
function toDrafts(strikes: Strike[], totalBeats: number): NoteDraft[] {
  const drafts: NoteDraft[] = [];
  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i];
    const nextBeat = i + 1 < strikes.length ? strikes[i + 1].gridBeat : totalBeats;
    const nominalBeat = Math.max(nextBeat - s.gridBeat, EPSILON);
    for (const pitch of s.pitches) {
      drafts.push({
        bar: s.bar,
        step: s.step,
        gridBeat: s.gridBeat,
        nominalBeat,
        accent: s.accent,
        ghost: s.ghost,
        pitch,
      });
    }
  }
  return drafts;
}

/** Resolve one track's drafts into finished NoteEvents (pipeline per design §4.3). */
function renderTrack(
  track: TrackId,
  drafts: NoteDraft[],
  style: StylePreset,
  input: PerformanceInput,
  picker: RoundRobinPicker,
): NoteEvent[] {
  const { seed, bpm } = input;
  const secPerBeat = 60 / bpm;

  // 1) velocity: accent × phrase × humanize, then break machine-gun runs.
  const velocities = drafts.map((d, i) =>
    computeVelocity({
      style,
      track,
      accent: d.accent,
      bar: d.bar,
      ghost: d.ghost,
      rng: streamFor(seed, 'vel', track, d.bar, d.step, i, d.pitch),
    }),
  );
  avoidFiveInARow(velocities, streamFor(seed, 'velGuard', track));

  // 2) microtiming, 3) gate/articulation, 4) round-robin.
  return drafts.map((d, i) => {
    const offsetMs = trackOffsetMs(seed, d.bar, d.step, track, style);
    const timeBeat = d.gridBeat + msToBeat(offsetMs, bpm);

    const nominalMs = d.nominalBeat * secPerBeat * 1000;
    const gate = computeGate(streamFor(seed, 'gate', track, d.bar, d.step, d.pitch), style, nominalMs);
    const durationBeat = d.nominalBeat * gate;
    const tie = style.gate.sustain === 'legato' && gate > 0.88 && i + 1 < drafts.length;

    const velocity = velocities[i];
    return {
      timeBeat,
      durationBeat,
      pitch: d.pitch,
      velocity,
      articulation: pickArticulation({ track, style, ghost: d.ghost, gate, tie }),
      rrIndex: picker.next(track, d.pitch, velocity),
      trackId: track,
      seed,
    };
  });
}

/**
 * Generate the full `NoteEvent[]` for a voice-led progression. Events are returned
 * sorted by `timeBeat` (ties broken by pitch) for stable, deterministic output.
 */
export function generatePerformance(
  input: PerformanceInput,
  options: PerformanceOptions,
): NoteEvent[] {
  if (input.chords.length === 0) return [];
  const style = getStyle(options.styleId);
  const totalBeats = totalBeatsOf(input.chords);
  const bars = Math.max(1, Math.ceil(totalBeats / style.beatsPerBar - EPSILON));
  const picker = new RoundRobinPicker(input.seed, style.roundRobin);

  const tracks: TrackId[] = options.drums === false ? ['chord', 'bass'] : ['chord', 'bass', 'kick', 'snare', 'hat'];
  const patternOf: Record<TrackId, StepPattern> = {
    chord: style.chord,
    bass: style.bass,
    kick: style.kick,
    snare: style.snare,
    hat: style.hat,
  };

  const events: NoteEvent[] = [];
  for (const track of tracks) {
    const strikes = collectStrikes(track, patternOf[track], style, input.chords, bars, totalBeats);
    const drafts = toDrafts(strikes, totalBeats);
    events.push(...renderTrack(track, drafts, style, input, picker));
  }

  events.sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
  return events;
}
