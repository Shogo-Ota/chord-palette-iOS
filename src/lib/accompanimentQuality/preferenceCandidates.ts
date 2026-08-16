/**
 * Offline listening candidates. Not produced by the production realizer.
 * Labels are shuffled so the listener cannot infer quality from the name.
 */

import { featuresFromVoicingPair } from './popVoicingFeatures';
import { preferenceFeaturesFromTransitions, type PreferenceFeatureVector } from './preferenceFeatures';
import { rejectOutliers, type OutlierReport } from './popOutlierRejector';
import { gateCandidate } from './hardGate';
import type { Pop909PriorV1, PopChordQuality, PopChordSpan, TransitionFeatures } from './types';

export type CandidateStyle =
  | 'connectedStable'
  | 'rootReset'
  | 'brokenOutlier'
  | 'connectedHigh'
  | 'inversionWalk';

export type ProgressionSpec = {
  id: string;
  display: string;
  chords: Array<Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>>;
};

export type PreferenceCandidate = {
  id: string;
  progressionId: string;
  style: CandidateStyle;
  blindLabel: string;
  progression: string[];
  voicings: number[][];
  transitions: TransitionFeatures[];
  features: PreferenceFeatureVector;
  hardGateOk: boolean;
  hardGateErrors: string[];
  outlier: OutlierReport;
};

function ch(
  symbol: string,
  rootPc: number,
  quality: PopChordQuality,
  bassPc = rootPc,
): Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'> {
  return { symbol, rootPc, quality, bassPc };
}

export const PREFERENCE_PROGRESSIONS: readonly ProgressionSpec[] = [
  {
    id: 'A',
    display: 'C | Am | F | G',
    chords: [
      ch('C', 0, 'major'),
      ch('Am', 9, 'minor'),
      ch('F', 5, 'major'),
      ch('G', 7, 'major'),
    ],
  },
  {
    id: 'B',
    display: 'D | Bm | G | A',
    chords: [
      ch('D', 2, 'major'),
      ch('Bm', 11, 'minor'),
      ch('G', 7, 'major'),
      ch('A', 9, 'major'),
    ],
  },
  {
    id: 'C',
    display: 'Cmaj7 | Am7 | Fmaj7 | G7',
    chords: [
      ch('Cmaj7', 0, 'maj7'),
      ch('Am7', 9, 'm7'),
      ch('Fmaj7', 5, 'maj7'),
      ch('G7', 7, '7'),
    ],
  },
  {
    id: 'D',
    display: 'C | G/B | Am | F',
    chords: [
      ch('C', 0, 'major'),
      ch('G/B', 7, 'major', 11),
      ch('Am', 9, 'minor'),
      ch('F', 5, 'major'),
    ],
  },
  {
    id: 'E',
    display: 'C | Cadd9 | Cmaj7 | C7',
    chords: [
      ch('C', 0, 'major'),
      ch('Cadd9', 0, 'add9'),
      ch('Cmaj7', 0, 'maj7'),
      ch('C7', 0, '7'),
    ],
  },
];

const STYLES_A: Record<CandidateStyle, number[][]> = {
  connectedStable: [
    [48, 52, 55, 60],
    [48, 52, 57, 60],
    [48, 53, 57, 60],
    [47, 50, 55, 59],
  ],
  rootReset: [
    [48, 52, 55],
    [45, 48, 52],
    [41, 45, 48],
    [43, 47, 50],
  ],
  brokenOutlier: [
    [72, 76, 79, 84],
    [33, 36, 40, 45],
    [65, 69, 72, 77],
    [31, 43, 47, 55],
  ],
  connectedHigh: [
    [55, 60, 64, 67],
    [57, 60, 64, 69],
    [53, 60, 65, 69],
    [55, 59, 62, 67],
  ],
  inversionWalk: [
    [52, 55, 60, 64],
    [52, 57, 60, 64],
    [53, 57, 60, 65],
    [50, 55, 59, 67],
  ],
};

const STYLES_C: Record<CandidateStyle, number[][]> = {
  connectedStable: [
    [48, 52, 55, 59],
    [48, 52, 55, 57],
    [48, 53, 57, 64],
    [47, 50, 55, 65],
  ],
  rootReset: [
    [48, 52, 55, 59],
    [45, 48, 52, 55],
    [41, 45, 48, 52],
    [43, 47, 50, 53],
  ],
  brokenOutlier: [
    [71, 76, 79, 83],
    [33, 36, 40, 43],
    [65, 69, 72, 76],
    [31, 43, 47, 53],
  ],
  connectedHigh: [
    [55, 59, 64, 67],
    [57, 60, 64, 67],
    [53, 57, 64, 69],
    [55, 59, 62, 65],
  ],
  inversionWalk: [
    [52, 55, 59, 64],
    [52, 55, 57, 64],
    [53, 57, 60, 64],
    [50, 53, 55, 67],
  ],
};

const STYLES_D: Record<CandidateStyle, number[][]> = {
  connectedStable: [
    [48, 52, 55, 60],
    [47, 50, 55, 59],
    [45, 48, 52, 57],
    [45, 48, 53, 57],
  ],
  rootReset: [
    [48, 52, 55],
    [47, 50, 55],
    [45, 48, 52],
    [41, 45, 48],
  ],
  brokenOutlier: [
    [72, 76, 79, 84],
    [35, 47, 50, 55],
    [33, 36, 40, 45],
    [65, 69, 72, 77],
  ],
  connectedHigh: [
    [55, 60, 64, 67],
    [59, 62, 67, 71],
    [57, 60, 64, 69],
    [53, 60, 65, 69],
  ],
  inversionWalk: [
    [52, 55, 60, 64],
    [47, 55, 59, 62],
    [48, 52, 57, 64],
    [48, 53, 57, 65],
  ],
};

const STYLES_E: Record<CandidateStyle, number[][]> = {
  connectedStable: [
    [48, 52, 55, 60],
    [48, 52, 55, 62],
    [48, 52, 55, 59],
    [48, 52, 55, 58],
  ],
  rootReset: [
    [48, 52, 55],
    [48, 52, 55, 62],
    [48, 52, 55, 59],
    [36, 48, 52, 58],
  ],
  brokenOutlier: [
    [72, 76, 79],
    [38, 48, 52, 55],
    [71, 76, 83],
    [24, 48, 52, 58],
  ],
  connectedHigh: [
    [55, 60, 64, 67],
    [55, 60, 64, 74],
    [55, 59, 64, 67],
    [55, 58, 64, 67],
  ],
  inversionWalk: [
    [52, 55, 60, 64],
    [52, 55, 62, 64],
    [52, 55, 59, 64],
    [52, 55, 58, 64],
  ],
};

function transposeGrid(grid: number[][], semitones: number): number[][] {
  return grid.map((row) => row.map((p) => p + semitones));
}

function stylesFor(progressionId: string): Record<CandidateStyle, number[][]> {
  if (progressionId === 'B') {
    return {
      connectedStable: transposeGrid(STYLES_A.connectedStable, 2),
      rootReset: transposeGrid(STYLES_A.rootReset, 2),
      brokenOutlier: transposeGrid(STYLES_A.brokenOutlier, 2),
      connectedHigh: transposeGrid(STYLES_A.connectedHigh, 2),
      inversionWalk: transposeGrid(STYLES_A.inversionWalk, 2),
    };
  }
  if (progressionId === 'C') return STYLES_C;
  if (progressionId === 'D') return STYLES_D;
  if (progressionId === 'E') return STYLES_E;
  return STYLES_A;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LABELS = ['P', 'Q', 'R', 'S', 'T'] as const;
const STYLE_IDS: CandidateStyle[] = [
  'connectedStable',
  'rootReset',
  'brokenOutlier',
  'connectedHigh',
  'inversionWalk',
];

function seedFor(progressionId: string): number {
  return [...progressionId].reduce((s, c) => s + c.charCodeAt(0) * 17, 20260815);
}

export function buildPreferenceCandidates(prior: Pop909PriorV1): PreferenceCandidate[] {
  const out: PreferenceCandidate[] = [];
  for (const prog of PREFERENCE_PROGRESSIONS) {
    const styles = stylesFor(prog.id);
    const labels = shuffle(LABELS, seedFor(prog.id));
    STYLE_IDS.forEach((style, i) => {
      const voicings = styles[style];
      const gate = gateCandidate(voicings, prog.chords);
      const transitions: TransitionFeatures[] = [];
      for (let t = 1; t < voicings.length; t += 1) {
        transitions.push(
          featuresFromVoicingPair(voicings[t - 1], voicings[t], prog.chords[t - 1], prog.chords[t]),
        );
      }
      out.push({
        id: `${prog.id}-${style}`,
        progressionId: prog.id,
        style,
        blindLabel: labels[i],
        progression: prog.chords.map((c) => c.symbol),
        voicings,
        transitions,
        features: preferenceFeaturesFromTransitions(transitions),
        hardGateOk: gate.ok,
        hardGateErrors: gate.errors,
        outlier: rejectOutliers(transitions, prior),
      });
    });
  }
  return out;
}

export function labelToIdMap(candidates: readonly PreferenceCandidate[], progressionId: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of candidates.filter((x) => x.progressionId === progressionId)) {
    map[c.blindLabel] = c.id;
  }
  return map;
}
