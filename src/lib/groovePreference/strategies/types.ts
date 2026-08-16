import type { GrooveCandidateType, GrooveTimeline, TeacherTake } from '../types';

export interface GrooveCandidateStrategy {
  readonly type: GrooveCandidateType;
  build(repeated: GrooveTimeline, actualTeacher: GrooveTimeline, take: TeacherTake): GrooveTimeline;
}

export function cloneTimeline(timeline: GrooveTimeline): GrooveTimeline {
  return {
    ...timeline,
    attacks: timeline.attacks.map((attack) => ({
      ...attack,
      notes: attack.notes.map((note) => ({ ...note })),
    })),
  };
}

export function withRecomputedStarts(timeline: GrooveTimeline): GrooveTimeline {
  return {
    ...timeline,
    attacks: timeline.attacks
      .map((attack) => ({
        ...attack,
        startBeat: attack.barIndex * timeline.beatsPerBar + attack.beatInBar,
      }))
      .sort((a, b) => a.startBeat - b.startBeat || a.sourceId.localeCompare(b.sourceId)),
  };
}
