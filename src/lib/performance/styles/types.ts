/**
 * Style presets express a groove as *data + tiny helpers* (never a giant switch or a
 * god class), so a new style is a new data file, not a code change (sprint-6 §4 /
 * design §4 "Groove skeleton: 8Beat / 16Beat / Ballad; accents, rests, ties,
 * anticipation as a probabilistic grammar"). Each field feeds one Performance Engine
 * layer, keeping responsibilities separated.
 */

import type { Articulation, TrackId } from '../NoteEvent';

/** The built-in grooves (design §4 requires at least 8Beat / 16Beat / Ballad). */
export type StyleId = 'eightBeat' | 'sixteenBeat' | 'ballad';

/** A per-step on/off pattern over one bar, with accent weights and ghost flags. */
export interface StepPattern {
  /** length = `stepsPerBar`; `true` = a hit on that step. */
  hits: boolean[];
  /** length = `stepsPerBar`; 0..1 accent weight per step (feeds the velocity layer). */
  accent: number[];
  /** length = `stepsPerBar` (optional); `true` marks a hit as a ghost note. */
  ghost?: boolean[];
}

/** Inclusive microtiming jitter window (milliseconds) around the shared bar feel. */
export interface MsRange {
  min: number;
  max: number;
}

/** Velocity shaping knobs (design §4 "Velocity": ±4–7 humanize, ghost 20–45). */
export interface VelocitySpec {
  /** Base velocity center per track (before accent / phrase / humanize). */
  center: Record<TrackId, number>;
  /** How strongly `accent` (0..1, centered on 0.6) scales into velocity. */
  accentDepth: number;
  /** Peak MIDI swing of the 2/4-bar phrase curve. */
  phraseDepth: number;
  /** Per-note humanize magnitude (MIDI), design range 4–7. */
  humanizeMin: number;
  humanizeMax: number;
  /** Ghost-note velocity window (design range 20–45). */
  ghostMin: number;
  ghostMax: number;
}

/** Gate/articulation knobs (design §4 "Duration": gate 0.72–0.95). */
export interface GateSpec {
  min: number;
  max: number;
  /** Default articulation for sustained (chord/bass) notes in this style. */
  sustain: Articulation;
}

/**
 * A full groove definition. `stepsPerBar` sets the grid resolution (8 = 8th notes,
 * 16 = 16th notes); every `StepPattern` here must have that length.
 */
export interface StylePreset {
  id: StyleId;
  displayName: string;
  beatsPerBar: number;
  stepsPerBar: number;
  chord: StepPattern;
  bass: StepPattern;
  kick: StepPattern;
  snare: StepPattern;
  hat: StepPattern;
  /**
   * Per-bar shared timing "feel" (ms): a single push/pull drawn once per bar that
   * ALL tracks inherit. This is what makes microtiming correlated (kick-referenced)
   * rather than independent per-note jitter (design §4 "Microtiming").
   */
  kickFeelMs: MsRange;
  /** Per-track jitter added on top of the shared bar feel (design §4 ranges). */
  microtiming: Record<TrackId, MsRange>;
  velocity: VelocitySpec;
  gate: GateSpec;
  /** Round-robin pool size per track (design §4: ≥3 variants). */
  roundRobin: number;
}

/** Beat position of a step within the bar. */
export function stepBeat(style: StylePreset, step: number): number {
  return (step * style.beatsPerBar) / style.stepsPerBar;
}
