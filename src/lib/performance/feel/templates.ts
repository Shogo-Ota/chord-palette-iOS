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
import { BALLAD } from '../styles/ballad';
import { EIGHT_BEAT } from '../styles/eightBeat';
import { NATURAL_COMP } from '../styles/naturalComp';
import { refineStyle, type StyleRefinement } from '../styles/refine';
import { SIXTEEN_BEAT } from '../styles/sixteenBeat';
import type { StepPattern, StylePreset } from '../styles/types';

import type { FeelContext, FeelId } from './types';

/** Tempo at/above which Driving switches from an 8-feel to the busier 16-feel. */
const DRIVING_SIXTEEN_TEMPO = 116;

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
  overrides: StyleRefinement;
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

/**
 * Resolve a feel's concrete template + humanize scale for a given context.
 *
 * `forcedBase` lets a caller pin the skeleton the feel's refinements land on — the
 * feel still sounds like itself, it just stops choosing its base from tempo and drum
 * groove. Used by the accompaniment variants that offer a fixed 8- or 16-feel.
 */
export function resolveFeelTemplate(
  feelId: FeelId,
  ctx: FeelContext,
  forcedBase?: StylePreset,
): { template: StylePreset; humanizeScale: number } {
  const def = FEEL_TEMPLATE_DEFS[feelId];
  return {
    template: refineStyle(forcedBase ?? def.pickBase(ctx), def.overrides),
    humanizeScale: def.humanizeScale,
  };
}
