import type { TeacherTake } from './types';

export type RawGrooveTeacherJson = {
  sourceId: string;
  meter?: { beatsPerBar?: number };
  timeline?: {
    ppq?: number;
    musicalOriginTick?: number;
    totalMusicalBars?: number;
  };
  attacks?: TeacherTake['attacks'];
  pedalEvents?: TeacherTake['pedalEvents'];
};

export function teacherTakeFromRaw(raw: RawGrooveTeacherJson): TeacherTake {
  const ppq = raw.timeline?.ppq ?? 480;
  const musicalOriginTick = raw.timeline?.musicalOriginTick ?? 0;
  const beatsPerBar = raw.meter?.beatsPerBar ?? 4;
  const totalMusicalBars = raw.timeline?.totalMusicalBars ?? 8;
  return {
    sourceId: raw.sourceId,
    ppq,
    musicalOriginTick,
    beatsPerBar,
    totalMusicalBars,
    attacks: (raw.attacks ?? []).filter(
      (attack) => attack.musicalBar >= 1 && attack.musicalBar <= totalMusicalBars,
    ),
    pedalEvents: (raw.pedalEvents ?? []).filter(
      (event) => event.musicalBar >= 1 && event.musicalBar <= totalMusicalBars,
    ),
  };
}
