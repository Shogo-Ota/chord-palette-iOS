export type GrooveCandidateType =
  | 'TEACHER_TIMELINE_REPEAT'
  | 'QUANTIZED_CONTROL'
  | 'SIMPLIFIED_DENSITY'
  | 'PHRASE_VARIATION'
  | 'BROKEN_CONTROL';

export type TeacherSourceNote = {
  voiceRole?: string;
  voicingPosition?: string;
  velocity?: number;
  relativeVelocity?: number;
  durationBeats?: number;
};

export type TeacherSourceAttack = {
  musicalBar: number;
  musicalBarInLoop: number;
  beatInMusicalBar: number;
  absoluteTick?: number;
  attackType?: string;
  relativeVelocity?: number;
  notes: TeacherSourceNote[];
};

export type TeacherSourcePedal = {
  musicalBar: number;
  beatInMusicalBar: number;
  absoluteTick?: number;
  state: 'down' | 'up';
  value: number;
};

export type TeacherTake = {
  sourceId: string;
  ppq: number;
  musicalOriginTick: number;
  beatsPerBar: number;
  totalMusicalBars: number;
  attacks: TeacherSourceAttack[];
  pedalEvents: TeacherSourcePedal[];
};

export type TimelineNote = {
  sourceNoteIndex: number;
  voiceRole?: string;
  voicingPosition?: string;
  velocity: number;
  durationBeat: number;
};

export type TimelineAttack = {
  sourceId: string;
  barIndex: number;
  beatInBar: number;
  startBeat: number;
  attackType?: string;
  notes: TimelineNote[];
};

export type GrooveTimeline = {
  attacks: TimelineAttack[];
  totalBars: number;
  beatsPerBar: number;
};

export type GrooveProgression = {
  id: 'A' | 'B' | 'C';
  display: string;
  chordSymbols: readonly string[];
  /** One ordered voicing per chord. Repeated for the second four-bar phrase. */
  fixedVoicings: readonly (readonly number[])[];
};

export type GrooveNote = {
  startBeat: number;
  durationBeat: number;
  pitch: number;
  velocity: number;
  barIndex: number;
  voiceIndex: number;
  sourceAttackId: string;
};

export type GrooveControlChange = {
  startBeat: number;
  controller: 64;
  value: number;
  channel: 0;
};

export type DistributionSummary = {
  values: number[];
  mean: number;
  std: number;
  median: number;
  p10: number;
  p90: number;
};

export type GrooveFeatureVector = {
  attackGroupsPerBar: number;
  attackDensity: number;
  restRatio: number;
  beatPositionHistogram: number[];
  offBeatRatio: number;
  syncopation: number;
  ioiDistribution: DistributionSummary;
  ioiVariation: number;
  gridDeviationMean: number;
  gridDeviationStd: number;
  gridDeviationPattern: number[];
  velocityMean: number;
  velocityStd: number;
  velocityRange: number;
  velocityContour: number[];
  accentPositions: number[];
  timingVelocityCorrelation: number;
  durationMedian: number;
  articulationRatio: number;
  cc64Coverage: number;
  phraseRepetitionSimilarity: number;
  phraseVariationAmount: number;
};

export type GrooveCandidate = {
  id: string;
  progressionId: GrooveProgression['id'];
  blindLabel: string;
  type: GrooveCandidateType;
  bpm: 70;
  totalBeats: 32;
  chordSymbols: readonly string[];
  fixedVoicings: readonly (readonly number[])[];
  notes: GrooveNote[];
  controlChanges: GrooveControlChange[];
  features: GrooveFeatureVector;
};

export type GrooveListeningScores = {
  overall: number;
  groove: number | null;
  naturalness: number | null;
  forwardMotion: number | null;
  rhythmFeel: number | null;
};

export type GrooveListeningSheet = {
  progressionId: GrooveProgression['id'];
  display: string;
  bpm: 70;
  ranking: string | null;
  candidates: {
    blindLabel: string;
    listening: GrooveListeningScores | null;
    comment?: string;
  }[];
};

export type GroovePreferencePair = {
  progressionId: GrooveProgression['id'];
  preferredId: string;
  rejectedId: string;
  preferredLabel: string;
  rejectedLabel: string;
};
