import type { GrooveCandidateStrategy } from './types';
import { cloneTimeline } from './types';

export const phraseVariationStrategy: GrooveCandidateStrategy = {
  type: 'PHRASE_VARIATION',
  build(_repeated, actualTeacher) {
    return cloneTimeline(actualTeacher);
  },
};
