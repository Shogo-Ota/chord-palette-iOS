/**
 * Offline High / Mid / Low voicing candidates.
 * Does not call or modify the production Voice Structure realizer.
 */

import { writeSmf } from '@/lib/midiExport/smfWrite';
import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';

import { featuresFromVoicingPair } from './popVoicingFeatures';
import { scoreTransition } from './popVoicingScore';
import type { Pop909PriorV1, PopChordSpan, TransitionFeatures } from './types';

export type CandidateGroup = 'high' | 'mid' | 'low';

export type BlindCandidate = {
  id: string;
  blindLabel: string;
  group: CandidateGroup;
  progression: string[];
  voicings: number[][];
  transitions: TransitionFeatures[];
  scores: ReturnType<typeof scoreTransition>[];
  meanScore: number;
};

const C_AM_F_G: Array<Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>> = [
  { rootPc: 0, quality: 'major', bassPc: 0, symbol: 'C' },
  { rootPc: 9, quality: 'minor', bassPc: 9, symbol: 'Am' },
  { rootPc: 5, quality: 'major', bassPc: 5, symbol: 'F' },
  { rootPc: 7, quality: 'major', bassPc: 7, symbol: 'G' },
];

/** Common-tone, small movement, stable register — typical pop piano. */
const HIGH_C_AM_F_G = [
  [48, 52, 55, 60],
  [48, 52, 57, 60],
  [48, 53, 57, 60],
  [47, 50, 55, 59],
];

/** Root-position reset each chord — legal but jumpy. */
const MID_C_AM_F_G = [
  [48, 52, 55],
  [45, 48, 52],
  [41, 45, 48],
  [43, 47, 50],
];

/** Register collapse / expansion and large leaps — outlier on purpose. */
const LOW_C_AM_F_G = [
  [72, 76, 79, 84],
  [33, 36, 40],
  [77, 81, 84],
  [31, 47, 50, 74],
];

function buildCandidate(
  id: string,
  blindLabel: string,
  group: CandidateGroup,
  voicings: number[][],
  chords: typeof C_AM_F_G,
  prior: Pop909PriorV1,
): BlindCandidate {
  const transitions: TransitionFeatures[] = [];
  const scores: ReturnType<typeof scoreTransition>[] = [];
  for (let i = 1; i < voicings.length; i += 1) {
    const feat = featuresFromVoicingPair(voicings[i - 1], voicings[i], chords[i - 1], chords[i]);
    transitions.push(feat);
    scores.push(scoreTransition(feat, prior));
  }
  const meanScore = scores.reduce((s, x) => s + x.score, 0) / Math.max(scores.length, 1);
  return {
    id,
    blindLabel,
    group,
    progression: chords.map((c) => c.symbol),
    voicings,
    transitions,
    scores,
    meanScore,
  };
}

export function pocCandidatesCAmFG(prior: Pop909PriorV1): BlindCandidate[] {
  return [
    buildCandidate('camfg-high', 'Candidate X', 'high', HIGH_C_AM_F_G, C_AM_F_G, prior),
    buildCandidate('camfg-mid', 'Candidate Y', 'mid', MID_C_AM_F_G, C_AM_F_G, prior),
    buildCandidate('camfg-low', 'Candidate Z', 'low', LOW_C_AM_F_G, C_AM_F_G, prior),
  ];
}

export function voicingsToSnapshot(
  voicings: readonly number[][],
  progression: readonly string[],
  bpm = 70,
): FinalMidiSnapshot {
  const notes = voicings.flatMap((pitches, i) =>
    pitches.map((pitch) => ({
      startBeat: i * 4,
      durationBeat: 3.5,
      pitch,
      velocity: 84,
      channel: 0,
      track: 'accompaniment' as const,
    })),
  );
  return {
    bpm,
    beatsPerBar: 4,
    timeSignature: { numerator: 4, denominator: 4 },
    totalBeats: voicings.length * 4,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes,
    controlChanges: [
      { startBeat: 0, controller: 64, value: 127, channel: 0 },
      { startBeat: voicings.length * 4 - 0.25, controller: 64, value: 0, channel: 0 },
    ],
    markers: progression.map((label, i) => ({ startBeat: i * 4, label })),
  };
}

export function candidateToSnapshot(candidate: BlindCandidate, bpm = 70): FinalMidiSnapshot {
  return voicingsToSnapshot(candidate.voicings, candidate.progression, bpm);
}

export function voicingsToMidiBytes(
  voicings: readonly number[][],
  progression: readonly string[],
  bpm = 70,
): Uint8Array {
  return writeSmf(voicingsToSnapshot(voicings, progression, bpm));
}

export function candidateToMidiBytes(candidate: BlindCandidate, bpm = 70): Uint8Array {
  return voicingsToMidiBytes(candidate.voicings, candidate.progression, bpm);
}
