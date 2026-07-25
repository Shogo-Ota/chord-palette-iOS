/**
 * Groove Engine types — data-driven accompaniment (Phase 6).
 * Spec: project/docs/design/GrooveEngineDesign.md, project/docs/music/Groove.md
 *
 * Runtime native still expands patterns today; this module is the TS source of
 * truth so patterns become testable and (next step) consumable by the renderer.
 */

import type { AccompanimentPattern, GrooveId } from '@/types';

export type PedalStyle = 'none' | 'ringCap' | 'cc64';

export type GrooveFeatures = {
  /** 0.5 = straight, ~0.666 = triplet swing. */
  swingRatio: number;
  timingBiasBeats: number;
  /** Per-beat accent multipliers (length 4) or empty. */
  velocityAccent: number[];
  ghostDensity: number;
  strumMs: number;
  pedalStyle: PedalStyle;
  humanize: { velocityAmount: number; timingAmountBeats: number };
};

export type GrooveSource =
  | { type: 'handcrafted' }
  | { type: 'gmd'; attribution: string }
  | { type: 'user-analysis'; label?: string };

export type GrooveProfile = {
  id: string;
  tags: string[];
  source: GrooveSource;
  features: GrooveFeatures;
  pianoPatternId: AccompanimentPattern;
  drumPatternId: GrooveId | 'pop8-min';
  bassPatternId?: string;
};

export type CompStroke = {
  beat: number;
  vel: number;
  look?: number;
};

export type PianoPart = 'bass' | 'body' | 'all';

export type PianoGridLayer = {
  part: PianoPart;
  strokes: CompStroke[];
  nominalRingBeats: number;
  strumSec: number;
  sparkle: boolean;
  timingAmountBeats: number;
  velAmount: number;
};

/** Declarative piano accompaniment pattern. */
export type PianoPatternDoc = {
  id: AccompanimentPattern;
  /** Grid layers (eightBeat / sixteenthBeat). */
  grids?: PianoGridLayer[];
  /** Chord-locked block / arpeggio modes. */
  mode?: 'block' | 'arpeggio';
};

export type DrumVoice = 'kick' | 'snare' | 'hatClosed' | 'hatOpen' | 'ride' | 'rim';

export type DrumHit = {
  beat: number;
  voice: DrumVoice;
  vel: number;
  tags?: string[];
};

export type DrumPatternDoc = {
  id: string;
  hits: DrumHit[];
};

/** Frame-level strike ready for a native renderer (mirrors Swift NoteStrike). */
export type NoteStrike = {
  startFrame: number;
  durationFrames: number;
  note: number;
  gain: number;
};

export type ChordTimelineEvent = {
  midiNotes: number[];
  startBeat: number;
  lengthBeats: number;
  velocity: number;
};

export type PianoCompileInput = {
  bpm: number;
  sampleRate: number;
  totalBeats: number;
  events: ChordTimelineEvent[];
  patternId: AccompanimentPattern;
};
