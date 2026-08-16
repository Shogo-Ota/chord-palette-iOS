import type { PerfChord } from '../PerformanceEngine';
import type { HarmonicDegree } from '../humanTemplate/degreeRoles';

export const VOICING_MASKS = ['FULL', 'TRIAD', 'ROOT_ONLY', 'SHELL', 'UPPER'] as const;

export type VoicingMask = (typeof VOICING_MASKS)[number];

export type PianoHandRole = 'LEFT' | 'RIGHT';

export type FullVoicingNote = {
  pitch: number;
  pc: number;
  interval: number;
  degree: HarmonicDegree;
  handRole: PianoHandRole;
  isBass: boolean;
  isDuplicate: boolean;
};

export type FullVoicing = {
  chordIndex: number;
  chord: PerfChord;
  notes: FullVoicingNote[];
};
