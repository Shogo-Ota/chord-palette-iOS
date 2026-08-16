import type { GrooveCandidateStrategy } from './types';
import { cloneTimeline } from './types';

export const teacherTimelineRepeatStrategy: GrooveCandidateStrategy = {
  type: 'TEACHER_TIMELINE_REPEAT',
  build(repeated) {
    return cloneTimeline(repeated);
  },
};
