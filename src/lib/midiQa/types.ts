import type { AccompanimentPattern } from '@/types';

import type { QaProgressionId } from './progressions';

export type FailureCategory =
  | 'harmony'
  | 'degree'
  | 'rhythm'
  | 'register'
  | 'transpose'
  | 'structure'
  | 'regression';

export type QaFailure = {
  category: FailureCategory;
  code: string;
  message: string;
  beat?: number;
  pitch?: number;
};

export type AttackGroup = {
  startBeat: number;
  pitches: number[];
  velocities: number[];
  durations: number[];
};

export type BarAnalysis = {
  chordLabel: string;
  startBeat: number;
  durationBeats: number;
  allowedPcs: number[];
  noteCount: number;
  attackGroupCount: number;
  attackGroups: AttackGroup[];
  illegalPitches: number[];
  missingEssentials: string[];
  duplicatePitches: number[];
  degreeCounts: Record<string, number>;
};

export type CaseAnalysis = {
  caseId: string;
  pattern: AccompanimentPattern;
  variantId: string;
  progressionId: QaProgressionId;
  humanTemplateId?: string;
  noteCount: number;
  cc64Count: number;
  pitchMin: number;
  pitchMax: number;
  registerSpan: number;
  bars: BarAnalysis[];
  failures: QaFailure[];
};

export type CaseVerdict = {
  analysis: CaseAnalysis;
  pass: boolean;
};

export type TransposePairResult = {
  pattern: AccompanimentPattern;
  variantId: string;
  applicable: boolean;
  pass: boolean;
  failures: QaFailure[];
};

export type GoldenDiff = {
  caseId: string;
  present: boolean;
  pass: boolean;
  pitchDiff: number;
  onsetDiff: number;
  durationDiff: number;
  velocityDiff: number;
  ccDiff: number;
  noteCountDiff: number;
  failures: QaFailure[];
};

export type PatternRollup = {
  pattern: AccompanimentPattern;
  variantId: string;
  cases: number;
  pass: number;
  fail: number;
  failCategories: Partial<Record<FailureCategory, number>>;
  failCodes: string[];
};

export type MidiQaReport = {
  generatedAt: string;
  corpus: number;
  pass: number;
  fail: number;
  regression: number;
  cases: CaseVerdict[];
  transpose: TransposePairResult[];
  golden: GoldenDiff[];
  byPattern: PatternRollup[];
  categoryCounts: Record<FailureCategory, number>;
  topFixes: Array<{ title: string; reason: string; count: number }>;
};
