/**
 * Declarative refinement of a style skeleton.
 *
 * A groove is expensive to write and cheap to bend: most of what separates two
 * readings of the same comp is a top voice, a push, a little more accent, a longer
 * gate. Rather than copy a whole `StylePreset` for each, a caller states the
 * difference and this layer applies it. Both the Feel layer (`feel/templates.ts`)
 * and the accompaniment variants (`variants/`) speak this one vocabulary, so a
 * refinement written for one is legible to the other.
 *
 * Pure and total: the base is never mutated, and a refinement that says nothing
 * returns the base unchanged.
 */

import type { CoreTrackId } from '../NoteEvent';

import {
  stepBeat,
  type AnticipationSpec,
  type ArpeggioSpec,
  type GateSpec,
  type MsRange,
  type StepPattern,
  type StylePreset,
  type VelocitySpec,
} from './types';

const EPSILON = 1e-9;

/** The difference between a base skeleton and the reading a caller wants. */
export interface StyleRefinement {
  /** Add a derived role-separation top voice (off-beats the chord leaves silent). */
  withTop?: boolean;
  /** Explicit top-voice rhythm (alternative to {@link withTop}); `null` removes it. */
  top?: StepPattern | null;
  /** Which chord tone the top voice plays (see {@link StylePreset.topTone}). */
  topTone?: StylePreset['topTone'];
  /** Set (`spec`) or remove (`null`) chord-change anticipation. */
  anticipation?: AnticipationSpec | null;
  /** Added to the base accent depth (stronger = more dynamic contrast). */
  accentDepthDelta?: number;
  /** Per-track microtiming window overrides (e.g. laid-back = positive window). */
  microtiming?: Partial<Record<CoreTrackId, MsRange>>;
  /** Gate overrides (e.g. longer sustain for Relaxed). */
  gate?: Partial<GateSpec>;
  /** Velocity overrides other than {@link accentDepthDelta}. */
  velocity?: Partial<Omit<VelocitySpec, 'center'>>;
  /** Replace the chord-body rhythm (e.g. halves instead of one whole-bar hit). */
  chord?: StepPattern;
  /** Replace the bass rhythm. */
  bass?: StepPattern;
  /** Spread the body one note at a time (`spec`), or strike it as a block (`null`). */
  arpeggio?: ArpeggioSpec | null;
}

/**
 * Build a top-voice rhythm from a base: hit every OFF-beat (`.5`) grid step the chord
 * leaves silent. This guarantees the top voice's rhythm differs from both the chord
 * (mid body) and the bass, so the three registers never move in lock-step (design §4
 * role separation). Returns null if the base leaves no such slot.
 */
export function buildTopPattern(base: StylePreset): StepPattern | null {
  const n = base.stepsPerBar;
  const hits = new Array<boolean>(n).fill(false);
  const accent = new Array<number>(n).fill(0.5);
  let any = false;
  for (let step = 0; step < n; step++) {
    const beat = stepBeat(base, step);
    const isHalfOffbeat = Math.abs(((beat * 2) % 2) - 1) < EPSILON; // beat ends in .5
    if (isHalfOffbeat && !base.chord.hits[step]) {
      hits[step] = true;
      accent[step] = 0.62;
      any = true;
    }
  }
  return any ? { hits, accent } : null;
}

/**
 * A caller that restates the gate is restating the whole articulation, so any
 * per-track windows the base carried are dropped unless the refinement brings its
 * own — otherwise a style's bass would keep breathing to a rule just replaced.
 */
function mergeGate(base: GateSpec, o?: Partial<GateSpec>): GateSpec {
  if (!o) return base;
  const merged: GateSpec = { ...base, ...o };
  if (!o.byTrack) delete merged.byTrack;
  return merged;
}

/** Apply a refinement to a base skeleton, returning a new preset. */
export function refineStyle(base: StylePreset, o: StyleRefinement): StylePreset {
  // The delta is relative to whatever the refinement itself just set, so stating both
  // an absolute depth and a delta reads as "this, then a bit more".
  const velocity = { ...base.velocity, ...(o.velocity ?? {}) };
  velocity.accentDepth += o.accentDepthDelta ?? 0;

  const style: StylePreset = {
    ...base,
    chord: o.chord ?? base.chord,
    bass: o.bass ?? base.bass,
    velocity,
    microtiming: { ...base.microtiming, ...(o.microtiming ?? {}) },
    gate: mergeGate(base.gate, o.gate),
  };

  if (o.anticipation === null) delete style.anticipation;
  else if (o.anticipation) style.anticipation = o.anticipation;

  if (o.arpeggio === null) delete style.arpeggio;
  else if (o.arpeggio) style.arpeggio = o.arpeggio;

  // An explicit top pattern wins; otherwise derive one from the base off-beats. The
  // derivation reads the *base* chord rhythm, so a refinement that replaces the chord
  // and asks for a top voice gets one built from what it just wrote.
  if (o.top === null) delete style.top;
  else if (o.top) style.top = o.top;
  else if (o.withTop) {
    const top = buildTopPattern(style);
    if (top) style.top = top;
  }
  if (o.topTone) style.topTone = o.topTone;
  return style;
}
