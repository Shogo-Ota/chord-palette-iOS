/**
 * Accompaniment pattern library — internal registration format
 * (implementation_v1.01 Phase 12).
 *
 * This is NOT a raw-MIDI store. A pattern is registered fully RELATIVE — beat
 * position inside the pattern, degree into the chord's tones, octave offset from
 * the role's home register, velocity as a ratio, duration in beats — so one
 * entry transplants onto any key, any chord and any progression. Raw MIDI from
 * commercial recordings must never be stored here; `sourceType`/`license` exist
 * so every entry carries its provenance (design v1.01 §9).
 *
 * v1.01 defines the format and its validator only; nothing renders from the
 * library yet.
 */

import type { Articulation } from '../NoteEvent';
import type { AccompanimentStyle, InstrumentRole, RhythmFeel } from '../model';

/** Where a pattern's material came from — the rights ledger's first field. */
export type PatternSourceType = 'original' | 'licensed' | 'publicDomain';

/**
 * One note of a pattern, in fully relative terms.
 *
 * `chordToneIndex` walks the sounding chord's tones in root-position order
 * (0 = root, 1 = 3rd, 2 = 5th, 3 = 7th/6th, 4+ = tensions); a chord with fewer
 * tones wraps modulo its length, so the same pattern plays a triad and a 13th.
 */
export interface RelativeNote {
  /** Position from the pattern head, in beats (0 ≤ pos < patternLengthBeats). */
  posBeats: number;
  /** Index into the chord's tones (see above) — never an absolute pitch. */
  chordToneIndex: number;
  /** Octaves above (+) / below (−) the instrument role's home register. */
  octaveOffset: number;
  /** Velocity relative to the pattern's peak (0 < ratio ≤ 1). */
  velocityRatio: number;
  /** Sounding length in beats (> 0). */
  durationBeats: number;
  articulation?: Articulation;
}

/** Summary statistics kept alongside the notes for search / comparison. */
export interface ProfileSummary {
  mean: number;
  stdDev: number;
}

/** One registered accompaniment pattern. */
export interface LibraryPattern {
  id: string;
  name: string;
  sourceType: PatternSourceType;
  /** Human-readable license/provenance note (e.g. "自作", "CC0 <URL>"). */
  license: string;
  style: AccompanimentStyle;
  rhythmFeel: RhythmFeel;
  timeSignature: { beatsPerBar: number; beatUnit: number };
  bpmRange: { min: number; max: number };
  instrumentRole: InstrumentRole;
  /** Total pattern length in beats (usually one or two bars). */
  patternLengthBeats: number;
  notes: RelativeNote[];
  velocityProfile?: ProfileSummary;
  durationProfile?: ProfileSummary;
  /** Per-beat accent weights (0..1), one per beat of the pattern. */
  accentMap?: number[];
  tags: string[];
  /** Curator's 1 (rough sketch) … 5 (ship-ready) quality grade. */
  qualityRating?: 1 | 2 | 3 | 4 | 5;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Format/content revision of this entry. */
  version: number;
}
