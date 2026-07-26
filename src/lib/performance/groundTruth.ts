/**
 * Measured characteristics of the reference performances the feel layer is tuned
 * against (`project/docs/music/GroundTruthMidi.md`).
 *
 * Only extracted statistics live here — never a phrase, a note or a chord from the
 * source performance, which is third-party material and stays out of the
 * repository. The numbers are produced by `tools/analyze_ground_truth_midi.py` and
 * mirrored from the committed `.features.json`, so a template that cites a
 * reference can be checked against what was actually measured instead of against
 * someone's memory of it.
 *
 * This module is data only. Which reference a feel follows, and how closely, is a
 * musical decision made in `templates.ts` / `profiles.ts`.
 */

/** Where a reference came from and why its audio/MIDI is not in the repository. */
export interface GroundTruthProvenance {
  /** Ledger id in `GroundTruthMidi.md`, e.g. "GT-001". */
  id: string;
  label: string;
  /** Redistribution terms — every reference so far is analysis-only. */
  usage: string;
  tempoBpm: number;
  styleTags: string[];
}

/** Median MIDI velocity by metrical role, plus the overall spread. */
export interface GroundTruthVelocity {
  downbeat: number;
  upbeat: number;
  sixteenthOff: number;
  p25: number;
  median: number;
  p75: number;
}

/** How far onsets sit from the grid. A median of 0 means the part is quantized. */
export interface GroundTruthTiming {
  medianOffsetMs: number;
  meanOffsetMs: number;
}

/** How widely the notes of one block chord are spread across the keyboard roll. */
export interface GroundTruthStrum {
  medianSpreadMs: number;
  p75SpreadMs: number;
  meanSpreadMs: number;
}

/** Share of onsets on the beat, on the "&", and on the 16th e/a positions (%). */
export interface GroundTruthOnsets {
  onBeat: number;
  and: number;
  sixteenth: number;
}

export interface GroundTruthReference {
  provenance: GroundTruthProvenance;
  velocity: GroundTruthVelocity;
  timing: GroundTruthTiming;
  strum: GroundTruthStrum;
  onsets: GroundTruthOnsets;
  /** Median sounding length of a mid-register note, in beats. */
  medianBodyDurationBeats: number;
  /** Off-beat 8th as a fraction of the beat; 0.5 = straight. */
  swingRatio: number;
}

/**
 * GT-001 — the owner's reference piano performance (125 BPM, J-pop / city-pop).
 * Notably quiet, near-perfectly quantized, tightly rolled and 16th-driven: nearly
 * half its onsets fall on the e/a positions rather than on beats.
 */
export const GT_001: GroundTruthReference = {
  provenance: {
    id: 'GT-001',
    label: '日もすがら音楽と / Piano (Reo)',
    usage: 'Third-party material. Analysis features only — never bundled or redistributed.',
    tempoBpm: 125,
    styleTags: ['j-pop', 'city-pop', 'programmed-piano'],
  },
  velocity: {
    downbeat: 75,
    upbeat: 71,
    sixteenthOff: 70.5,
    p25: 64,
    median: 73,
    p75: 79,
  },
  timing: {
    medianOffsetMs: 0,
    meanOffsetMs: 2.0,
  },
  strum: {
    medianSpreadMs: 0,
    p75SpreadMs: 6.5,
    meanSpreadMs: 3.2,
  },
  onsets: {
    onBeat: 35.5,
    and: 20.2,
    sixteenth: 44.3,
  },
  medianBodyDurationBeats: 0.296,
  swingRatio: 0.5,
};

/**
 * How much louder a downbeat is than a 16th off-beat in the reference (MIDI units).
 * This is the honest ceiling for accent depth: GT-001 separates its roles by only a
 * few velocity steps, so a template that swings tens of units is not imitating it.
 */
export function accentSpreadMidi(gt: GroundTruthReference): number {
  return gt.velocity.downbeat - gt.velocity.sixteenthOff;
}

/** Half-width of the reference's velocity band (p25..p75), in MIDI units. */
export function velocitySpreadMidi(gt: GroundTruthReference): number {
  return (gt.velocity.p75 - gt.velocity.p25) / 2;
}
