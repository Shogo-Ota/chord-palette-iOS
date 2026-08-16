/** Voice roles used for POP909 prior extraction and scoring. */
export type PopVoiceRole = 'BASS' | 'INNER' | 'UPPER' | 'TOP';

export type PopInversion = 'root' | 'first' | 'second' | 'other';

export type PopChordQuality =
  | 'major'
  | 'minor'
  | 'maj7'
  | '7'
  | 'm7'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'hdim7'
  | 'dim7'
  | 'mM7'
  | 'aug7'
  | 'add9'
  | '9'
  | 'maj9'
  | 'm9'
  | 'other'
  | 'N';

export type ColorDegreeLabel =
  | '7'
  | 'b7'
  | '9'
  | 'b9'
  | '#9'
  | '11'
  | '#11'
  | '13'
  | 'b13';

export type NumericSummary = {
  count: number;
  mean: number;
  std: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
};

export type CategoryDistribution = Record<string, { count: number; probability: number }>;

export type PopVoicing = {
  pitches: number[];
  onsetBeat: number;
};

export type PopChordSpan = {
  startBeat: number;
  endBeat: number;
  rootPc: number;
  bassPc: number;
  quality: PopChordQuality;
  symbol: string;
};

export type VoiceLeadingFeatures = {
  voiceCountBefore: number;
  voiceCountAfter: number;
  commonToneCount: number;
  commonToneRate: number;
  totalVoiceMovementSemitones: number;
  meanVoiceMovement: number;
  medianVoiceMovement: number;
  maxVoiceMovement: number;
  voiceCrossing: number;
  retainedVoiceCount: number;
};

export type BassFeatures = {
  bassMidi: number;
  bassDegree: string;
  bassMovementSemitones: number | null;
  inversion: PopInversion;
  bassLeapSize: number | null;
};

export type TopFeatures = {
  topMidi: number;
  topDegree: string;
  topMovementSemitones: number | null;
  commonToneRetained: boolean | null;
  stepwise: boolean | null;
  contour: 'up' | 'down' | 'same' | null;
};

export type RegisterFeatures = {
  lowestPitch: number;
  highestPitch: number;
  registerCenter: number;
  totalSpan: number;
  adjacentVoiceIntervals: number[];
  registerCenterDelta: number | null;
  spanDelta: number | null;
  lowestPitchDelta: number | null;
  highestPitchDelta: number | null;
};

export type VoicingStructureFeatures = {
  voiceCount: number;
  degreeSet: string[];
  doublingPattern: string;
  omissionPattern: string;
  spacingProxy: 'close' | 'open' | 'spread';
  inversion: PopInversion;
  intervalStructure: number[];
};

export type ExtensionPlacement = {
  degree: ColorDegreeLabel;
  midi: number;
  relativePosition: number;
  role: PopVoiceRole;
  isHighest: boolean;
  distanceAboveRoot: number;
};

export type RhythmDensityFeatures = {
  attackGroupsInSpan: number;
  noteCountInPrimary: number;
  attackDensityPerBeat: number;
  restRatio: number;
  beatPosition: number;
  syncopated: boolean;
};

export type TransitionFeatures = {
  sourceQuality: PopChordQuality;
  targetQuality: PopChordQuality;
  rootMotionSemitones: number;
  sharedToneCount: number;
  voiceLeading: VoiceLeadingFeatures;
  bass: BassFeatures;
  top: TopFeatures;
  register: RegisterFeatures;
  structure: VoicingStructureFeatures;
  extensions: ExtensionPlacement[];
  rhythm: RhythmDensityFeatures;
};

export type PopVoicingScoreBreakdown = {
  score: number;
  components: {
    voiceLeading: number;
    register: number;
    bass: number;
    top: number;
    extension: number;
  };
  warnings: string[];
};

export type Pop909PriorV1 = {
  version: 1;
  dataset: string;
  metadata: {
    analyzerVersion: string;
    date: string;
    gitCommit: string | null;
    songCount: number;
    includedSampleCount: number;
    excludedSampleCount: number;
    exclusionReasons: Record<string, number>;
    pocSongLimit: number | null;
  };
  voiceLeading: {
    meanVoiceMovement: NumericSummary;
    totalVoiceMovement: NumericSummary;
    maxVoiceMovement: NumericSummary;
    topMovement: NumericSummary;
    bassMovement: NumericSummary;
    commonToneRate: NumericSummary;
    voiceCrossing: NumericSummary;
  };
  register: {
    center: NumericSummary;
    centerDelta: NumericSummary;
    span: NumericSummary;
    spanDelta: NumericSummary;
    lowest: NumericSummary;
    highest: NumericSummary;
  };
  bass: {
    degreeProbability: CategoryDistribution;
    inversionProbability: CategoryDistribution;
  };
  top: {
    degreeProbability: CategoryDistribution;
    movement: NumericSummary;
  };
  extensions: Record<
    string,
    {
      roleProbability: CategoryDistribution;
      relativeRegister: NumericSummary;
      isHighestRate: number;
    }
  >;
};
