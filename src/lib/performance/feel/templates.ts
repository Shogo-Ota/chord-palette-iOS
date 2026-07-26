/**
 * Refined internal groove templates for each Feel (design §3-1). A feel picks a base
 * skeleton by tempo + drum-groove family and layers small, data-driven refinements on
 * top (a top-voice rhythm for role separation, anticipation, accent depth, laid-back
 * microtiming, gate). Base grooves are reused as data — no giant switch.
 *
 *  - Natural  → Good Song Top 10 piano-comp distill (`naturalComp`): straight
 *    quarter-note chord body + walking & bass. Attack timing only from the MIDI.
 *  - Driving  → busier 16-feel when the song is fast or on a 16-groove (else a punchy
 *    8-feel): stronger accents, offbeat top voice, tighter timing (0.82).
 *  - Relaxed  → Ballad-leaning sustained base: legato long tones, laid-back (behind
 *    the beat) microtiming, looser humanize (1.15). Space comes from the sparse base.
 */

import { familyOf } from '../groove/drumProfiles';
import type { CoreTrackId } from '../NoteEvent';
import { BALLAD } from '../styles/ballad';
import { EIGHT_BEAT } from '../styles/eightBeat';
import { NATURAL_COMP } from '../styles/naturalComp';
import { SIXTEEN_BEAT } from '../styles/sixteenBeat';
import {
  stepBeat,
  type AnticipationSpec,
  type GateSpec,
  type MsRange,
  type StepPattern,
  type StylePreset,
} from '../styles/types';
import type { FeelContext, FeelId } from './types';

const EPSILON = 1e-9;

/** Tempo at/above which Driving switches from an 8-feel to the busier 16-feel. */
const DRIVING_SIXTEEN_TEMPO = 116;

/**
 * Build a top-voice rhythm from a base: hit every OFF-beat (`.5`) grid step the chord
 * leaves silent. This guarantees the top voice's rhythm differs from both the chord
 * (mid body) and the bass, so the three registers never move in lock-step (design §4
 * role separation). Returns null if the base leaves no such slot.
 */
function buildTopPattern(base: StylePreset): StepPattern | null {
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

/** Small, declarative refinements a feel layers onto its base skeleton. */
interface TemplateOverrides {
  /** Add a derived role-separation top voice (off-beats the chord leaves silent). */
  withTop?: boolean;
  /** Explicit top-voice rhythm (alternative to {@link withTop}). */
  top?: StepPattern;
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
}

/**
 * A feel that restates the gate is restating the whole articulation, so any
 * per-track windows the base style carried are dropped unless the override brings
 * its own — otherwise a style's bass would keep breathing to a rule the feel just
 * replaced.
 */
function mergeGate(base: GateSpec, o?: Partial<GateSpec>): GateSpec {
  if (!o) return base;
  const merged: GateSpec = { ...base, ...o };
  if (!o.byTrack) delete merged.byTrack;
  return merged;
}

function deriveTemplate(base: StylePreset, o: TemplateOverrides): StylePreset {
  const template: StylePreset = {
    ...base,
    velocity: {
      ...base.velocity,
      accentDepth: base.velocity.accentDepth + (o.accentDepthDelta ?? 0),
    },
    microtiming: { ...base.microtiming, ...(o.microtiming ?? {}) },
    gate: mergeGate(base.gate, o.gate),
  };

  if (o.anticipation === null) delete template.anticipation;
  else if (o.anticipation) template.anticipation = o.anticipation;

  // An explicit top pattern wins; otherwise derive one from the base off-beats.
  if (o.top) template.top = o.top;
  else if (o.withTop) {
    const top = buildTopPattern(base);
    if (top) template.top = top;
  }
  if (o.topTone) template.topTone = o.topTone;
  return template;
}

/**
 * Relaxed's top voice: a SINGLE note on beat 3 only (step 4 of BALLAD's 8-step bar).
 * Voiced as the chord's 3rd (`topTone: 'third'`) it drops a gentle melodic answer into
 * the ballad's held chords. `rests` only touch the chord track, so this note is reliably
 * present (a rare bass-only breather bar aside).
 */
const RELAXED_TOP_THIRD: StepPattern = {
  hits: [false, false, false, false, true, false, false, false],
  accent: [0.5, 0.5, 0.5, 0.5, 0.62, 0.5, 0.5, 0.5],
};

/** A feel's base-selection strategy + refinements + humanize scale (pure data). */
interface FeelTemplateDef {
  pickBase(ctx: FeelContext): StylePreset;
  overrides: TemplateOverrides;
  humanizeScale: number;
}

const FEEL_TEMPLATE_DEFS: Record<FeelId, FeelTemplateDef> = {
  // MIDI-learned straight quarters + & bass. No synthetic top (would collide with bass &s).
  natural: {
    pickBase: () => NATURAL_COMP,
    overrides: { anticipation: null },
    humanizeScale: 1.0,
  },
  driving: {
    pickBase: (ctx) =>
      familyOf(ctx.grooveId) === 'sixteen' || ctx.tempoBpm >= DRIVING_SIXTEEN_TEMPO
        ? SIXTEEN_BEAT
        : EIGHT_BEAT,
    overrides: {
      withTop: true,
      // Anticipation + a deeper accent contrast push the off-beat top voice forward,
      // so the holes opened by the extra rests read as syncopation, not gaps.
      anticipation: { maxLeadBeats: 0.5 },
      accentDepthDelta: 9,
      gate: { min: 0.68 },
    },
    humanizeScale: 0.82,
  },
  relaxed: {
    pickBase: () => BALLAD,
    overrides: {
      anticipation: null,
      // Laid-back: chord/bass sit slightly BEHIND the beat (positive window).
      microtiming: { chord: { min: 2, max: 12 }, bass: { min: 1, max: 8 } },
      gate: { min: 0.85, max: 0.97 },
      // A single 3rd on beat 3 (melodic answer over the held ballad chords).
      top: RELAXED_TOP_THIRD,
      topTone: 'third',
    },
    humanizeScale: 1.15,
  },
};

/** Resolve a feel's concrete template + humanize scale for a given context. */
export function resolveFeelTemplate(
  feelId: FeelId,
  ctx: FeelContext,
): { template: StylePreset; humanizeScale: number } {
  const def = FEEL_TEMPLATE_DEFS[feelId];
  return { template: deriveTemplate(def.pickBase(ctx), def.overrides), humanizeScale: def.humanizeScale };
}
