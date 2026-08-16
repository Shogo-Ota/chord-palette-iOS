/**
 * Human-label schema for blind listening.
 * Scores / features must not appear on the listener worksheet or MIDI names.
 */

export type ListeningScores = {
  overall: number;
  chordClarity: number;
  voicing: number;
  voiceLeading: number;
  register: number;
  naturalness: number;
};

export type PreferenceListeningScores = {
  overall: number;
  voicing: number;
  voiceLeading: number;
  register: number;
  naturalness: number;
};

export type ListeningSample = {
  candidateId: string;
  input: {
    progression: string[];
    pattern: string;
    bpm: number;
  };
  features: unknown;
  pop909Score: number;
  listening: ListeningScores | null;
};

export type PreferencePair = {
  preferred: string;
  rejected: string;
  reason: string[];
};

export type ProgressionListeningSheet = {
  progressionId: string;
  display: string;
  bpm: number;
  ranking: string | null;
  candidates: Array<{
    blindLabel: string;
    listening: PreferenceListeningScores | null;
    comment?: string;
  }>;
};

export const LISTENING_SCORE_FIELDS: readonly (keyof ListeningScores)[] = [
  'overall',
  'chordClarity',
  'voicing',
  'voiceLeading',
  'register',
  'naturalness',
];

export const PREFERENCE_SCORE_FIELDS: readonly (keyof PreferenceListeningScores)[] = [
  'overall',
  'voicing',
  'voiceLeading',
  'register',
  'naturalness',
];
