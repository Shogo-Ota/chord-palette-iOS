/**
 * Measured drum Humanize Profile derived from Groove MIDI Dataset statistics.
 * This is MEASURED data — never a Design Target until an engineer applies it.
 */

import type { GmdVoice } from './gmdDrumMap';

export interface VelocityStats {
  count: number;
  mean: number;
  stdDev: number;
  p10: number;
  p50: number;
  p90: number;
  /** Share of hits with velocity ≤ ghostMax (inclusive). */
  ghostRate: number;
}

export interface TimingStats {
  count: number;
  /** Mean |onset − nearest 16th grid| in beats. */
  absDeviationMeanBeats: number;
  absDeviationStdDevBeats: number;
  /** Signed (onset − grid) mean; negative = early. */
  signedDeviationMeanBeats: number;
  /** Same stats in milliseconds at the file's annotated BPM. */
  absDeviationMeanMs: number;
  signedDeviationMeanMs: number;
}

export interface TempoBinId {
  /** Inclusive min BPM for the bin. */
  minBpm: number;
  /** Exclusive max BPM (Infinity allowed as a large number in JSON). */
  maxBpm: number;
  label: string;
}

export interface VoiceBinStats {
  voice: GmdVoice;
  velocity: VelocityStats;
  timing: TimingStats;
}

export interface TempoBinProfile {
  bin: TempoBinId;
  fileCount: number;
  hitCount: number;
  beatFileCount: number;
  fillFileCount: number;
  byVoice: Partial<Record<GmdVoice, VoiceBinStats>>;
}

export interface GmdDrumProfile {
  /** Schema version of this profile JSON. */
  profileVersion: 'gmd-drum-v1';
  dataClass: 'measured';
  source: {
    datasetName: 'Groove MIDI Dataset';
    datasetVersion: 'v1.0.0-midionly';
    officialURL: 'https://magenta.withgoogle.com/datasets/groove';
    license: 'CC BY 4.0';
    licensor: 'Google LLC';
    attribution: string;
    citation: string;
  };
  /** Analysis knobs (not musical Design Targets). */
  analysis: {
    gridDivisionsPerBeat: number;
    ghostVelocityMax: number;
    tempoBins: TempoBinId[];
    filesParsed: number;
    filesFailed: number;
    totalHits: number;
  };
  generatedAt: string;
  overall: {
    byVoice: Partial<Record<GmdVoice, VoiceBinStats>>;
    fillFileRate: number;
  };
  byTempoBin: TempoBinProfile[];
  /** Per-style aggregates for styles present in info.csv (primary token before '/'). */
  byPrimaryStyle: Record<
    string,
    { fileCount: number; hitCount: number; byVoice: Partial<Record<GmdVoice, VoiceBinStats>> }
  >;
}

export interface GmdInfoRow {
  drummer: string;
  id: string;
  style: string;
  bpm: number;
  beatType: 'beat' | 'fill' | string;
  timeSignature: string;
  midiFilename: string;
  split: string;
  duration: number;
}
