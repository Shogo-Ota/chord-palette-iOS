import { brokenControlStrategy } from './brokenControl';
import { phraseVariationStrategy } from './phraseVariation';
import { quantizedControlStrategy } from './quantizedControl';
import { simplifiedDensityStrategy } from './simplifiedDensity';
import { teacherTimelineRepeatStrategy } from './teacherTimelineRepeat';
import type { GrooveCandidateStrategy } from './types';

export const GROOVE_CANDIDATE_STRATEGIES: readonly GrooveCandidateStrategy[] = [
  teacherTimelineRepeatStrategy,
  quantizedControlStrategy,
  simplifiedDensityStrategy,
  phraseVariationStrategy,
  brokenControlStrategy,
];

export type { GrooveCandidateStrategy } from './types';
