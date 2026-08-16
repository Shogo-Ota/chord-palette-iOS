/**
 * Style presets express a groove as *data + tiny helpers* (never a giant switch or a
 * god class), so a new style is a new data file, not a code change (sprint-6 §4 /
 * design §4 "Groove skeleton: 8Beat / 16Beat / Ballad; accents, rests, ties,
 * anticipation as a probabilistic grammar"). Each field feeds one Performance Engine
 * layer, keeping responsibilities separated.
 */

import type { Articulation, CoreTrackId, TrackId } from '../NoteEvent';

/**
 * The built-in grooves. User-facing accompaniment maps to block / arpeggio / feels;
 * `eightBeat` / `sixteenBeat` / `ballad` / `naturalComp*` are internal skeletons
 * (Natural Feel rotates through the `naturalComp` bank distilled from the Good Song
 * Top 10 MIDI: A `naturalComp`, B `naturalCompSparse`, C `naturalCompDense`).
 */
export type StyleId =
  | 'block'
  | 'eightBeat'
  | 'sixteenBeat'
  | 'arpeggio'
  | 'ballad'
  | 'naturalComp'
  | 'naturalCompSparse'
  | 'naturalCompDense'
  | 'shuffle'
  | 'swing'
  | 'bossa'
  | 'reggae'
  | 'waltz'
  | 'sixEight';

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
  /** Base velocity center per core track (before accent / phrase / humanize). */
  center: Record<CoreTrackId, number>;
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
  /**
   * How much the TOP note of a multi-pitch chord strike is lifted above its inner
   * voices (implementation_v1.01 Phase 4: 「トップノートをわずかに目立たせる」;
   * inner voices give back 1). Omitted = the engine default (+3). Single-pitch
   * strikes and non-chord tracks are unaffected.
   */
  topEmphasis?: number;
}

/** A gate window — the sounding fraction of a note's nominal length. */
export interface GateRange {
  min: number;
  max: number;
}

/** Gate/articulation knobs (design §4 "Duration": gate 0.72–0.95). */
export interface GateSpec extends GateRange {
  /** Default articulation for sustained (chord/bass) notes in this style. */
  sustain: Articulation;
  /**
   * Windows for tracks that do not breathe like the rest of the style. Reference
   * performances rarely hold their bass and their chords for the same fraction of
   * the beat, so a style may say so per track; tracks left out use the shared range.
   */
  byTrack?: Partial<Record<TrackId, GateRange>>;
}

/**
 * Chord-change anticipation ("食い"): when a chord/bass stroke falls within
 * `maxLeadBeats` of the *next* chord's boundary, that single stroke pre-empts the
 * next chord's voicing (pushing into it on the off-beat) — the harmony changes
 * early while the attack time stays on the grid. Off (or 0) = no anticipation.
 */
export interface AnticipationSpec {
  /** How far ahead of the next chord boundary a stroke may pre-empt it (beats). */
  maxLeadBeats: number;
}

/**
 * Arpeggio mode: instead of striking the whole chord body at once, the chord track
 * sounds ONE note per hit, cycling through an index order into the chord's arp
 * source (root-position tones when available, else the body — wrapped by the note
 * count so triads never break). The cycle advances within a chord and resets on
 * every chord change.
 */
export type ArpeggioDirection = 'up' | 'down' | 'upDown';

export interface ArpeggioSpec {
  /** Explicit index cycle (e.g. `[0, 1, 2, 3, 2, 1]`). Overrides the derived shape. */
  order?: number[];
  /**
   * Shape to derive from the actual note count, so triads and tension chords keep the
   * same contour: `up` climbs 1 3 5 7, `down` falls 7 5 3 1, `upDown` bounces without
   * repeating the endpoints (a 7th spells 1 3 5 7 5 3, a 9th 1 3 5 7 9 7 5 3).
   * Defaults to `upDown`.
   */
  direction?: ArpeggioDirection;
  /** @deprecated Equivalent to `direction: 'upDown'`; kept for existing presets. */
  upDown?: boolean;
}

/**
 * Swing feel for the comp (chord/top): the off-beat 8th (the "&") is pushed from the
 * straight midpoint (0.5 of the beat) toward `offbeatRatio` of the beat, so the beat's
 * two 8ths form the ride cymbal's long-short pattern. 0.5 = straight, 0.667 = triplet
 * ("triple feel"). The swing ratio is tempo-dependent (Friberg & Sundström, Music
 * Perception 2002: ~3.5:1 at slow tempi → 1:1 at fast); the resolved ratio is set by
 * the groove-lock so the comp locks to the (triplet) ride. On-beats and 16th e/a stay
 * put so the off-beat is the only moving part (matches the RC long-short pattern).
 */
export interface SwingSpec {
  /** Off-beat 8th position as a fraction of the beat (0.5 straight … 0.75 dotted). */
  offbeatRatio: number;
}

/**
 * Strum ("roll"): a real player never lands every note of a block chord at the exact
 * same instant — the hand rolls across the keys/strings over a few milliseconds. This
 * spreads the onsets of ONE block chord's body notes over a small window so the chord
 * reads as "played by hands" rather than a machine stab. Applies ONLY to the block
 * `chord` track (never arpeggio — that is already one note per hit — nor bass/drums).
 *
 * The spread is tempo-scaled (ms → beats via bpm), seed-humanized, and clamped so it
 * can never push a note past its own window (safe at fast tempi / short ¼-bar chords).
 * All values are deterministic given the seed. Off (undefined) = simultaneous strike.
 */
export interface StrumSpec {
  /** Total onset spread across the chord's body notes (ms) at the played tempo. */
  spreadMs: number;
  /** Roll direction: `up` = low→high (default piano feel), `down` = high→low. */
  direction: 'up' | 'down' | 'alternate';
  /** Seed-derived jitter (ms) added to the per-note spread so rolls are not rigid. */
  humanizeMs?: number;
  /** 0..1 — how much later notes soften (velocity trails across the roll). */
  velocityFalloff?: number;
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
   * Optional top-voice (最上声部) rhythm for role separation (design §4). When set,
   * the engine re-articulates the highest chord body note on THIS pattern's steps —
   * distinct from the mid-body `chord` rhythm and the `bass` rhythm — so the three
   * registers never move in lock-step. Its steps should sit where `chord` is silent
   * (no doubling), and it inherits `chord`'s velocity/microtiming (no own spec). Left
   * undefined by `block` / `arpeggio` / `ballad` where a single body rhythm is wanted.
   */
  top?: StepPattern;
  /**
   * Which chord tone the {@link top} voice plays (default `high`). `third` voices the
   * chord's 3rd above the body as a melody note — see {@link TopTone}.
   */
  topTone?: TopTone;
  /**
   * Per-bar shared timing "feel" (ms): a single push/pull drawn once per bar that
   * ALL tracks inherit. This is what makes microtiming correlated (kick-referenced)
   * rather than independent per-note jitter (design §4 "Microtiming").
   */
  kickFeelMs: MsRange;
  /** Per-core-track jitter added on top of the shared bar feel (design §4 ranges). */
  microtiming: Record<CoreTrackId, MsRange>;
  velocity: VelocitySpec;
  gate: GateSpec;
  /** Round-robin pool size per track (design §4: ≥3 variants). */
  roundRobin: number;
  /**
   * Optional chord-change anticipation (the "食い" push). Only the syncopated pop
   * grooves set this; `block` / `arpeggio` / `ballad` leave it undefined (no push).
   */
  anticipation?: AnticipationSpec;
  /**
   * Optional arpeggio spec. When present, the chord track is spread one note at a
   * time (see {@link ArpeggioSpec}); when absent the body is struck as a block.
   */
  arpeggio?: ArpeggioSpec;
  /**
   * Strike every chord tone (arpMidi, else body) together and hold them. Used by
   * the Block pattern — no human-template figuration.
   */
  holdAllChordTones?: boolean;
  /**
   * Optional swing feel (see {@link SwingSpec}). Set by the groove-lock for swing
   * grooves; absent = straight 8ths. Only the comp (chord/top) swings — the bass keeps
   * the pulse — so the walking/root feel stays on the beat.
   */
  swing?: SwingSpec;
  /**
   * Optional strum/roll for the block {@link chord} track (see {@link StrumSpec}).
   * Absent = simultaneous block strike. Ignored when {@link arpeggio} is set.
   */
  strum?: StrumSpec;
}

/** Beat position of a step within the bar. */
export function stepBeat(style: StylePreset, step: number): number {
  return (step * style.beatsPerBar) / style.stepsPerBar;
}

/**
 * Which chord tone the optional top voice re-articulates:
 *  - `high`  (default): the highest chord-body note (role-separation upper voice).
 *  - `third`: the chord's 3rd, voiced just above the body so it sings as a melody
 *    note (e.g. Relaxed's single 3rd on beat 3).
 */
export type TopTone = 'high' | 'third';
