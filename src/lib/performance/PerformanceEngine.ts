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

import { isAccompanimentPattern } from '@/lib/accompaniment';

import { pickArticulation, computeGate } from './articulation';
import { planBassLine } from './bass';
import { bassProfileFor } from './bass/profiles';
import {
  applyEnergyProfile,
  bassProfileWithEnergy,
  DEFAULT_ENERGY,
  energyProfileFor,
  normalizeEnergy,
  type AccompanimentEnergy,
} from './energy';
import { libraryPatternById, realizeLibraryPattern } from './library';
import { humanTemplateById, realizeHumanTemplate } from './humanTemplate';
import { realizeIndependentStyle } from './independentStyles';
import { ensureChordAudible } from './ensureChordAudible';
import { pickNaturalTemplate } from './feel/naturalBank';
import { resolveFeel } from './feel/resolve';
import { profileFor } from './groove/drumProfiles';
import { lockToGroove } from './groove/lockToGroove';
import { msToBeat, swingDelayBeats, tempoTimingScale, trackOffsetMs } from './microtiming';
import type { AccompanimentStyle } from './model/types';
import { axesFor } from './model/axes';
import { clampVelocity, type NoteEvent, type TrackId } from './NoteEvent';
import { drumPatternFor, rhythmFor } from './rhythms';
import { RoundRobinPicker } from './roundRobin';
import { streamFor } from './rng';
import { strumOffsetBeats, strumVelocityScale } from './strum';
import type { Strike, StrikesByTrack } from './strike';
import { getStyle, type StyleId } from './styles';
import { refineStyle } from './styles/refine';
import { stepBeat, type ArpeggioSpec, type StylePreset, type StepPattern } from './styles/types';
import { resolveVariant } from './variants';
import { avoidFiveInARow, computeVelocity } from './velocity';
import { applyVariation, type VariationContext, type VariationProfile } from './variation';

import type { ChordHarmonyInput } from './strictV2';

/** A single voice-led chord placed on the timeline (bass anchored + re-voiced body). */
export interface PerfChord {
  /** Re-voiced chord body notes (MIDI). */
  bodyMidi: number[];
  /** Anchored bass notes (MIDI), lowest → highest. May be empty. */
  bassMidi: number[];
  /**
   * User chord harmony for strict-v2 human templates (symbol + allowed tones).
   * Omitted for legacy/tests that only need MIDI voicing.
   */
  harmony?: ChordHarmonyInput;
  /**
   * Optional root-position arpeggio source (root, 3rd, 5th, 7th, tensions…)
   * ascending. When present, the `arpeggio` style spreads THESE notes so the
   * figure spells 1-3-5-7 up/down (kept even with tensions). Falls back to
   * {@link bodyMidi} when absent.
   */
  arpMidi?: number[];
  /** Absolute start beat from the head of the progression. */
  startBeat: number;
  /** Length in beats. */
  durationBeats: number;
}

/**
 * Ascending-then-descending index cycle WITHOUT doubling the extremes, so the
 * bounce sounds natural (no repeated top/bottom note): `n=4 → [0,1,2,3,2,1]`
 * (a 7th chord spells 1 3 5 7 5 3, then repeats). Generalizes to any note count,
 * so tension chords keep the same smooth up/down shape (e.g. a 9th 1 3 5 7 9 7 5 3).
 */
function upDownOrder(n: number): number[] {
  if (n <= 1) return [0];
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i); // ascend 0 → n-1
  for (let i = n - 2; i >= 1; i--) order.push(i); // descend n-2 → 1 (endpoints not repeated)
  return order;
}

/** The index cycle a spec asks for, derived from how many notes the chord actually has. */
function arpeggioOrder(spec: ArpeggioSpec, n: number): number[] {
  if (spec.order) return spec.order;
  const ascending = Array.from({ length: Math.max(1, n) }, (_, i) => i);
  switch (spec.direction) {
    case 'up':
      return ascending;
    case 'down':
      return ascending.reverse();
    default:
      return upDownOrder(n);
  }
}

/** Domain input to the engine — pure data, no service/native types. */
export interface PerformanceInput {
  chords: PerfChord[];
  bpm: number;
  /** Project seed: same seed ⇒ same performance (design §1 / §6). */
  seed: number;
}

export interface PerformanceOptions {
  /**
   * The accompaniment selector. Either an id from the rhythm catalog (`natural`,
   * `beat8`, …), whose entry says how to build it, or a direct style id (`eightBeat`,
   * `ballad`, …) that bypasses the Feel and Variation layers entirely.
   */
  styleId: StyleId | string;
  /**
   * Sub-variation of the accompaniment (`natural.sparse`, `block.half`, …). Unknown
   * or absent falls back to the accompaniment's default reading, so a project saved
   * before variants existed renders exactly as it did.
   */
  variantId?: string;
  /**
   * Drum groove id (`pop8` / `pop16` / …). Only used to give the Feel layer its
   * resolution context (which base skeleton a feel pairs with); ignored for the
   * direct-style path. Defaults to `pop8`.
   */
  grooveId?: string;
  /** Emit kick/snare/hat tracks (default true). */
  drums?: boolean;
  /**
   * Style × Energy 「盛り上がり」. Default `build` preserves pre-Energy takes.
   * Does NOT enter the playback seed fingerprint (Energy A/B compares share a seed).
   */
  energy?: AccompanimentEnergy;
  /**
   * Long-term style axis for Energy profile lookup. When omitted, derived from
   * `styleId` via {@link axesFor}.
   */
  accompanimentStyle?: AccompanimentStyle;
  /**
   * Micro-humanization window multiplier (monetization tier — see `tier.ts`). Applied
   * on top of the tempo × feel scale. Default 1 = unchanged (free tier / callers that
   * don't set it), so the pre-tier output is reproduced byte-for-byte.
   */
  humanizeBoost?: number;
  /**
   * Block-chord strum (roll) spread multiplier (monetization tier). Default 1 = the
   * style's own spread unchanged. Only affects the block `chord` track's roll width.
   */
  strumScale?: number;
  /**
   * Opt-in accompaniment LibraryPattern id (Ballad only). When set and the style
   * axis is ballad, piano chord/top strikes come from realizeLibraryPattern instead
   * of the hand-authored skeleton. Bass/drums keep the existing path. Omit for
   * migration-compatible default behaviour.
   */
  libraryPatternId?: string;
  /**
   * Human MIDI Template (strict v2). When set, replaces chord/top skeleton with
   * degree-generalized teacher groove. Takes precedence over libraryPatternId.
   */
  humanTemplateId?: string;
  /**
   * Human Template pitch path. Omitted = production (`userChord`).
   * `teacherFidelity` is the Phase 1 / 2 regression path only.
   */
  humanTemplatePitchMode?: 'sharedBase' | 'userChord' | 'teacherFidelity';
}

/** General-MIDI-style pitches for the synthesized drum voices. */
const DRUM_PITCH: Record<'kick' | 'snare' | 'hat', number> = {
  kick: 36,
  snare: 38,
  hat: 42,
};

/** A flattened, per-pitch note awaiting velocity/timing/articulation resolution. */
interface NoteDraft {
  bar: number;
  step: number;
  gridBeat: number;
  nominalBeat: number;
  accent: number;
  ghost: boolean;
  pitch: number;
  /** Held across the following beat (set by the Variation `ties` rule). */
  tie?: boolean;
  /** Held as a phrase-end sustain (set by the Variation `phraseFill` rule). */
  sustain?: boolean;
  /** 0-based position of this pitch within its strike (ascending) — for strum. */
  strumRank: number;
  /** Number of simultaneous pitches in this strike — for strum. */
  strumSize: number;
  /** Highest pitch of a multi-pitch strike (velocity top emphasis, v1.01 Phase 4). */
  strikeTop: boolean;
  /** Sequential strike index within the track — for `alternate` strum direction. */
  strumStrike: number;
}

const EPSILON = 1e-9;

/** Gate applied to a Variation-held (tie / sustain) note so it rings across. */
const HELD_GATE = 0.98;

/** Phrase length in bars (pop convention) — the Variation layer's phrase window. */
const PHRASE_LENGTH = 4;

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

/** The next chord that starts strictly after `beat` (the upcoming boundary), if any. */
function nextChord(chords: PerfChord[], beat: number): PerfChord | undefined {
  for (const c of chords) {
    if (c.startBeat > beat + EPSILON) return c;
  }
  return undefined;
}

/**
 * Which chord a chord/bass stroke at `gridBeat` should actually voice. Normally the
 * active chord — but when the style has anticipation and the next chord boundary is
 * within `maxLeadBeats`, the stroke pre-empts (voices) the *next* chord (the "食い"):
 * `activeChord(gridBeat + distanceToBoundary)`. The attack time is never moved; only
 * the harmony is swapped. Pure and deterministic (no rng). Non-chord/bass tracks and
 * styles without anticipation always get the active chord.
 */
function chordForStrike(
  chords: PerfChord[],
  gridBeat: number,
  style: StylePreset,
  track: TrackId,
): PerfChord | undefined {
  const current = activeChord(chords, gridBeat);
  if (!current) return undefined;
  const lead = style.anticipation?.maxLeadBeats ?? 0;
  if (lead <= 0 || (track !== 'chord' && track !== 'bass')) return current;
  const upcoming = nextChord(chords, gridBeat);
  if (!upcoming) return current; // last chord: nothing to anticipate
  const distance = upcoming.startBeat - gridBeat;
  return distance > EPSILON && distance <= lead + EPSILON ? upcoming : current;
}

/** The bass pitch for a chord: the highest anchored bass note (most audible). */
function bassPitch(chord: PerfChord): number | undefined {
  if (chord.bassMidi.length > 0) return Math.max(...chord.bassMidi);
  if (chord.bodyMidi.length > 0) return Math.min(...chord.bodyMidi) - 12;
  return undefined;
}

/**
 * The top-voice pitch for a chord. Default (`high`) re-articulates the highest body
 * tone (role separation). `third` plays the chord's 3rd (root-position `arpMidi[1]`)
 * voiced at or just above the body top so it sings as a melody note; falls back to the
 * highest body tone when no arp source is available.
 */
function topVoicePitch(chord: PerfChord, tone: StylePreset['topTone']): number | undefined {
  const bodyTop = chord.bodyMidi.length > 0 ? Math.max(...chord.bodyMidi) : undefined;
  if (tone === 'third' && chord.arpMidi && chord.arpMidi.length >= 2) {
    let third = chord.arpMidi[1];
    const floor = bodyTop ?? third;
    while (third < floor) third += 12; // lift into the top register (melody)
    return third;
  }
  return bodyTop;
}

/**
 * Collect the raw grid strikes for one track over the bar range `[startBar, endBar)`.
 * The full progression is `[0, bars)`; the Natural bank calls this once per 4-bar
 * phrase with a different template (see {@link collectBankStrikes}). Bar numbers stay
 * absolute so per-note velocity/microtiming streams (keyed by bar) are unaffected by
 * how the range is sliced.
 */
function collectStrikes(
  track: TrackId,
  pattern: StepPattern,
  style: StylePreset,
  chords: PerfChord[],
  startBar: number,
  endBar: number,
  totalBeats: number,
): Strike[] {
  const strikes: Strike[] = [];
  // Arpeggio cycle state (chord track only): advances per hit, resets each new chord.
  let arpChord: PerfChord | undefined;
  let arpIndex = 0;
  let arpOrder: number[] = [];
  for (let bar = startBar; bar < endBar; bar++) {
    for (let step = 0; step < style.stepsPerBar; step++) {
      if (!pattern.hits[step]) continue;
      const gridBeat = bar * style.beatsPerBar + stepBeat(style, step);
      if (gridBeat >= totalBeats - EPSILON) continue; // stay inside the progression
      const chord = chordForStrike(chords, gridBeat, style, track);
      if (!chord) continue;

      let pitches: number[];
      if (track === 'chord') {
        if (style.arpeggio && chord.bodyMidi.length > 0) {
          // Spread one note per hit. Prefer the root-position `arpMidi` (so the
          // figure spells 1-3-5-7 up/down, kept with tensions); fall back to the
          // voice-led body when no arp source is provided. The order is the
          // explicit `order`, else an up/down cycle derived from the note count.
          const source = chord.arpMidi && chord.arpMidi.length > 0 ? chord.arpMidi : chord.bodyMidi;
          if (chord !== arpChord) {
            arpChord = chord;
            arpIndex = 0;
            arpOrder = arpeggioOrder(style.arpeggio, source.length);
          }
          const bodyIndex = arpOrder[arpIndex % arpOrder.length] % source.length;
          pitches = [source[bodyIndex]];
          arpIndex++;
        } else if (style.holdAllChordTones) {
          // Block must strike the exact Shared Base body. `arpMidi` is a legacy
          // root-position source for the hidden arpeggio style and may collide
          // with an inverted/shared bass.
          pitches = chord.bodyMidi;
        } else {
          pitches = chord.bodyMidi;
        }
      } else if (track === 'top') {
        // Role-separation top voice on its own rhythm (design §4). Pitch = highest body
        // tone by default, or the chord's 3rd (`topTone: 'third'`) as a melody note.
        // No spec of its own — inherits chord velocity/timing.
        const p = topVoicePitch(chord, style.topTone);
        pitches = p === undefined ? [] : [p];
      } else if (track === 'bass') {
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

/**
 * Collect one track's strikes for a template BANK, rotating the template per 4-bar
 * phrase (Natural feel). Each phrase's template is chosen deterministically by
 * `pickNaturalTemplate(seed, phraseIndex)`, and its strikes are gathered over that
 * phrase's absolute bar range and concatenated. All bank members share the same grid
 * resolution / gate / velocity / microtiming, so only the per-track rhythm changes
 * between phrases — the engine keeps rendering with a single (`style`) spec afterwards.
 */
function collectBankStrikes(
  track: TrackId,
  bank: readonly StylePreset[],
  chords: PerfChord[],
  bars: number,
  totalBeats: number,
  seed: number,
): Strike[] {
  const strikes: Strike[] = [];
  for (let startBar = 0, phrase = 0; startBar < bars; startBar += PHRASE_LENGTH, phrase++) {
    const endBar = Math.min(bars, startBar + PHRASE_LENGTH);
    const template = pickNaturalTemplate(seed, phrase, bank);
    strikes.push(
      ...collectStrikes(
        track,
        patternFor(template, track),
        template,
        chords,
        startBar,
        endBar,
        totalBeats,
      ),
    );
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
    const size = s.pitches.length;
    const topPitch = size > 1 ? Math.max(...s.pitches) : undefined;
    s.pitches.forEach((pitch, rank) => {
      drafts.push({
        bar: s.bar,
        step: s.step,
        gridBeat: s.gridBeat,
        nominalBeat,
        accent: s.accent,
        ghost: s.ghost,
        pitch,
        tie: s.tie,
        sustain: s.sustain,
        strumRank: rank,
        strumSize: size,
        strikeTop: topPitch !== undefined && pitch === topPitch,
        strumStrike: i,
      });
    });
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
  timingScale: number,
  strumScale: number,
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
      // Chord-role shaping (v1.01 Phase 4): only multi-pitch chord strikes carry
      // roles — the top note sings, the inner voices sit slightly back.
      chordRole: track === 'chord' && d.strumSize > 1 ? (d.strikeTop ? 'top' : 'inner') : undefined,
      rng: streamFor(seed, 'vel', track, d.bar, d.step, i, d.pitch),
    }),
  );
  avoidFiveInARow(velocities, streamFor(seed, 'velGuard', track));

  // 2) microtiming, 3) gate/articulation, 4) round-robin.
  return drafts.map((d, i) => {
    const offsetMs = trackOffsetMs(seed, d.bar, d.step, track, style, timingScale);
    // Swing pushes the comp's off-beat 8ths late (chord/top only; the bass keeps the
    // pulse). Directed shift in beats, on top of the ms humanize jitter.
    const swingBeat = track === 'chord' || track === 'top' ? swingDelayBeats(style, d.step) : 0;

    // Strum ("roll"): spread a BLOCK chord's body notes over a few ms so the chord
    // is played by hands, not a machine. Block chord track only (arpeggio is already
    // one note per hit; bass/top/drums keep the pulse). Clamped to half the note so it
    // never runs past its own window at fast tempi / short chords.
    let strumBeat = 0;
    let strumVel = 1;
    if (track === 'chord' && style.strum && !style.arpeggio && d.strumSize > 1) {
      const rng = streamFor(seed, 'strum', d.bar, d.step, d.pitch);
      // Tier widens the roll (strumScale). scale 1 = the style's own spread unchanged.
      const spec =
        strumScale === 1
          ? style.strum
          : { ...style.strum, spreadMs: style.strum.spreadMs * strumScale };
      strumBeat = strumOffsetBeats(
        d.strumRank,
        d.strumSize,
        spec,
        bpm,
        rng,
        d.strumStrike,
        d.nominalBeat * 0.5,
      );
      strumVel = strumVelocityScale(d.strumRank, d.strumSize, spec, d.strumStrike);
    }
    const timeBeat = d.gridBeat + msToBeat(offsetMs, bpm) + swingBeat + strumBeat;

    // A Variation-held note (tie / phrase-end sustain) rings across to the next
    // strike at a near-full gate; otherwise resolve the gate normally.
    const held = d.tie === true || d.sustain === true;
    const nominalMs = d.nominalBeat * secPerBeat * 1000;
    const gate = held
      ? HELD_GATE
      : computeGate(
          streamFor(seed, 'gate', track, d.bar, d.step, d.pitch),
          style,
          nominalMs,
          track,
        );
    const durationBeat = d.nominalBeat * gate;
    const tie = held || (style.gate.sustain === 'legato' && gate > 0.88 && i + 1 < drafts.length);

    const velocity =
      strumVel === 1 ? velocities[i] : clampVelocity(Math.round(velocities[i] * strumVel));
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

/** The concrete style + optional Variation profile + humanize scale to render. */
interface ResolvedPlan {
  style: StylePreset;
  /** Present only for Feels; `block`/`arpeggio`/direct styles have no Variation. */
  variation?: VariationProfile;
  /** Micro-humanization window multiplier (1 for direct styles). */
  humanizeScale: number;
  /**
   * The comp template bank the collect stage rotates through per 4-bar phrase (see
   * {@link collectBankStrikes}), when the chosen variant asks for more than one. All
   * members share `style`'s render-relevant specs, so `style` still drives rendering.
   */
  bank?: readonly StylePreset[];
}

/**
 * Resolve the render plan from the options. What an accompaniment id means is stated
 * in the rhythm catalog, not branched on here: a `feel` entry goes through the Feel +
 * Variation layers, a `style` entry plays its own skeleton and says for itself whether
 * it wants Variation and groove-lock. An id the catalog does not know — a direct or
 * retired style id (`eightBeat`, `ballad`, …) — falls through to the bare style lookup
 * it has always used.
 *
 * The chosen sub-variation lands last, on whichever skeleton came out of that — it
 * bends a reading rather than replacing one, so the accompaniment still sounds like
 * itself. A variant that names a bank rotates through it; the rest play one template.
 */
function resolvePlan(options: PerformanceOptions, bpm: number): ResolvedPlan {
  // Only catalog accompaniments carry variants. A direct or retired style id resolves
  // exactly as it always has.
  const variant = isAccompanimentPattern(options.styleId)
    ? resolveVariant(options.styleId, options.variantId)
    : undefined;
  const bend = (s: StylePreset) => (variant?.refine ? refineStyle(s, variant.refine) : s);
  // A bank of one is not a rotation — it is the skeleton the variant wants played.
  const singleton = variant?.bank?.length === 1 ? variant.bank[0] : undefined;
  const rotation = variant?.bank && variant.bank.length > 1 ? variant.bank : undefined;

  const rhythm = rhythmFor(options.styleId);
  const grooveId = options.grooveId ?? 'pop8';
  // Some rhythms own their drum pattern (waltz, shuffle, …). Lock the comp to that
  // pattern, not to a 4/4 kit the player left selected underneath.
  const drumId = drumPatternFor(grooveId, options.styleId);
  // Groove-lock: nudge the comp to agree with the drum groove that is playing (subtle
  // accent/microtiming only — hit positions unchanged). Applied to the render template
  // AND every bank member so a per-phrase rotation locks too.
  const profile = profileFor(drumId);

  if (rhythm?.source.kind === 'feel') {
    const base = variant?.forcedBase ?? singleton;
    const feel = resolveFeel(rhythm.source.feelId, { tempoBpm: bpm, grooveId }, base);
    return {
      style: lockToGroove(bend(feel.template), profile, bpm),
      variation: feel.variation,
      humanizeScale: feel.humanizeScale,
      bank: rotation?.map((t) => lockToGroove(bend(t), profile, bpm)),
    };
  }

  if (rhythm?.source.kind === 'style') {
    const source = rhythm.source;
    const lock = (s: StylePreset) => (source.grooveLock ? lockToGroove(s, profile, bpm) : s);
    const base = variant?.forcedBase ?? singleton ?? source.style;
    return {
      style: lock(bend(base)),
      variation: source.variation,
      humanizeScale: source.humanizeScale ?? 1,
      bank: rotation?.map((t) => lock(bend(t))),
    };
  }

  return { style: bend(singleton ?? getStyle(options.styleId)), humanizeScale: 1 };
}

/** The tracks to render for a style: `top` is added only when the style defines it. */
function tracksFor(style: StylePreset, drums: boolean, omitLegacyBass: boolean): TrackId[] {
  const tracks: TrackId[] = ['chord'];
  if (style.top) tracks.push('top');
  if (!omitLegacyBass) tracks.push('bass');
  if (drums) tracks.push('kick', 'snare', 'hat');
  return tracks;
}

/** The step pattern a track reads (the optional `top` falls back to the chord grid). */
function patternFor(style: StylePreset, track: TrackId): StepPattern {
  const patterns: Record<TrackId, StepPattern | undefined> = {
    chord: style.chord,
    top: style.top,
    bass: style.bass,
    kick: style.kick,
    snare: style.snare,
    hat: style.hat,
  };
  return patterns[track] ?? style.chord;
}

/**
 * Generate the full `NoteEvent[]` for a voice-led progression. Events are returned
 * sorted by `timeBeat` (ties broken by pitch) for stable, deterministic output.
 *
 * Pipeline (design §3): Groove Template (`collectStrikes`) → Musical Variation
 * (`applyVariation`, Feels only) → Micro Humanization (`renderTrack`).
 */
export function generatePerformance(
  input: PerformanceInput,
  options: PerformanceOptions,
): NoteEvent[] {
  if (input.chords.length === 0) return [];

  const independent = realizeIndependentStyle(options.styleId, input);
  if (independent) return independent;

  const energy = normalizeEnergy(options.energy ?? DEFAULT_ENERGY);
  const accompanimentStyle: AccompanimentStyle =
    options.accompanimentStyle ?? axesFor(String(options.styleId))?.style ?? 'band';
  const energyProfile = energyProfileFor(accompanimentStyle, energy);
  // Human MIDI Template (strict v2) — production path for natural / variation.
  const humanTemplate = options.humanTemplateId
    ? humanTemplateById(options.humanTemplateId)
    : undefined;
  // Ballad-only opt-in: legacy LibraryPattern (superseded when humanTemplate is set).
  const libraryPattern =
    !humanTemplate && accompanimentStyle === 'ballad' && options.libraryPatternId
      ? libraryPatternById(options.libraryPatternId)
      : undefined;

  let { style, variation, humanizeScale, bank } = resolvePlan(options, input.bpm);
  const energized = applyEnergyProfile(style, variation, energyProfile);
  style = energized.style;
  variation = energized.variation;
  // Bank templates get the same Energy bend so phrase rotation stays consistent.
  if (bank) {
    bank = bank.map((t) => applyEnergyProfile(t, undefined, energyProfile).style);
  }

  const totalBeats = totalBeatsOf(input.chords);
  const bars = Math.max(1, Math.ceil(totalBeats / style.beatsPerBar - EPSILON));
  const picker = new RoundRobinPicker(input.seed, style.roundRobin);
  const tracks = tracksFor(style, options.drums !== false, !!humanTemplate);

  // 1) Groove Template: collect the deterministic grid strikes for every track. The
  // Natural feel rotates its comp bank per 4-bar phrase; every other path uses a
  // single template across the whole progression.
  const strikesByTrack: StrikesByTrack = {};
  for (const track of tracks) {
    // Human/library path owns piano chord/top; leave empty so Variation cannot rewrite them.
    if ((humanTemplate || libraryPattern) && (track === 'chord' || track === 'top')) {
      strikesByTrack[track] = [];
      continue;
    }
    strikesByTrack[track] = bank
      ? collectBankStrikes(track, bank, input.chords, bars, totalBeats, input.seed)
      : collectStrikes(track, patternFor(style, track), style, input.chords, 0, bars, totalBeats);
  }

  // Energy register: raise/lower chord + top only (bass stays to avoid mud).
  // Block holds the user's chord tones — a non-octave shift would leave the chord.
  const reg = energized.registerOffsetSemitones;
  if (reg !== 0 && !style.holdAllChordTones) {
    for (const track of ['chord', 'top'] as const) {
      const list = strikesByTrack[track];
      if (!list) continue;
      for (const s of list) {
        s.pitches = s.pitches.map((p) => Math.max(0, Math.min(127, p + reg)));
      }
    }
  }

  // 1b) Bass-line planning (v1.01 Phase 7): re-pitch the collected bass strikes
  // (root / fifth / octave / passing / approach) per the rhythm's movement
  // profile. Grid, velocity and timing are untouched; root-only profiles (the
  // textures, ballad feel, legacy ids) return the strikes unchanged.
  if (strikesByTrack.bass) {
    const baseBass = bassProfileFor(String(options.styleId));
    const bassProfile = bassProfileWithEnergy(baseBass, energized.bassApproachProbability);
    strikesByTrack.bass = planBassLine(strikesByTrack.bass, {
      seed: input.seed,
      styleId: String(options.styleId),
      bassProfile,
      chordOf: (s) => chordForStrike(input.chords, s.gridBeat, style, 'bass'),
    });
  }

  // 2) Musical Variation (Feels only): rewrite chord/top strikes with intent.
  const varied = variation
    ? applyVariation(
        strikesByTrack,
        style,
        {
          bars,
          beatsPerBar: style.beatsPerBar,
          stepsPerBar: style.stepsPerBar,
          phraseLength: PHRASE_LENGTH,
          bpm: input.bpm,
        } satisfies VariationContext,
        variation,
        input.seed,
      )
    : strikesByTrack;

  // 3) Micro Humanization: render each track to NoteEvents. The window is scaled
  // by tempo (tighter when fast) × the feel's humanizeScale (looser/tighter feel) ×
  // the tier's humanizeBoost (monetization; 1 = free/unchanged — see tier.ts).
  const humanizeBoost = options.humanizeBoost ?? 1;
  const strumScale = options.strumScale ?? 1;
  const timingScale = tempoTimingScale(input.bpm) * humanizeScale * humanizeBoost;
  const events: NoteEvent[] = [];
  for (const track of tracks) {
    const strikes: Strike[] = varied[track] ?? [];
    const drafts = toDrafts(strikes, totalBeats);
    events.push(...renderTrack(track, drafts, style, input, picker, timingScale, strumScale));
  }

  if (humanTemplate) {
    const realized = realizeHumanTemplate(humanTemplate, input.chords, {
      seed: input.seed,
      trackId: 'chord',
      pitchMode:
        options.humanTemplatePitchMode ??
        (options.styleId === 'natural' ? 'sharedBase' : 'userChord'),
    });
    const drumsOnly = events.filter(
      (e) => e.trackId === 'kick' || e.trackId === 'snare' || e.trackId === 'hat',
    );
    events.length = 0;
    events.push(...drumsOnly, ...realized);
  } else if (libraryPattern) {
    const realized = realizeLibraryPattern(libraryPattern, input.chords, {
      seed: input.seed,
      velocityCenter: style.velocity.center.chord,
      trackId: 'chord',
    });
    const kept = events.filter((e) => e.trackId !== 'chord' && e.trackId !== 'top');
    events.length = 0;
    events.push(...kept, ...realized);
  }

  events.sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);

  // Absolute audibility invariant (safety net): whatever the style / feel /
  // variation / seed, never emit a chord whose bar has no pitched sound. Injects
  // a block chord on any otherwise-silent bar's downbeat. Normally a no-op.
  return ensureChordAudible(events, input.chords, input.seed);
}
