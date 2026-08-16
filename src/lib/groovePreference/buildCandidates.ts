import { extractGrooveFeatures } from './features';
import { GROOVE_PROGRESSIONS } from './progressions';
import { GROOVE_CANDIDATE_STRATEGIES } from './strategies';
import {
  repeatedTeacherPedal,
  teacherPhraseVariation,
  teacherTimelineRepeat,
} from './teacherTimeline';
import type {
  GrooveCandidate,
  GrooveNote,
  GrooveProgression,
  GrooveTimeline,
  TeacherTake,
  TimelineNote,
} from './types';

const LABELS = ['P', 'Q', 'R', 'S', 'T'] as const;

function preferredVoiceIndex(note: TimelineNote, voiceCount: number): number {
  const role = (note.voiceRole ?? note.voicingPosition ?? '').toLowerCase();
  if (role === 'bass' || role === 'lowest') return 0;
  if (role === 'top' || role === 'highest') return voiceCount - 1;
  if (role === 'upper') return Math.max(0, voiceCount - 2);
  if (role === 'inner' && voiceCount > 2) {
    return 1 + (note.sourceNoteIndex % (voiceCount - 2));
  }
  return note.sourceNoteIndex % voiceCount;
}

function assignVoiceIndices(
  notes: readonly TimelineNote[],
  voiceCount: number,
): {
  note: TimelineNote;
  voiceIndex: number;
}[] {
  const used = new Set<number>();
  const assigned: { note: TimelineNote; voiceIndex: number }[] = [];
  for (const note of notes) {
    const preferred = preferredVoiceIndex(note, voiceCount);
    const order = Array.from({ length: voiceCount }, (_, index) => index).sort(
      (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b,
    );
    const voiceIndex = order.find((index) => !used.has(index));
    if (voiceIndex == null) continue;
    used.add(voiceIndex);
    assigned.push({ note, voiceIndex });
  }
  return assigned;
}

function realizeTimeline(timeline: GrooveTimeline, progression: GrooveProgression): GrooveNote[] {
  const notes: GrooveNote[] = [];
  for (const attack of timeline.attacks) {
    const voicing = progression.fixedVoicings[attack.barIndex % progression.fixedVoicings.length];
    if (!voicing?.length) continue;
    for (const assigned of assignVoiceIndices(attack.notes, voicing.length)) {
      notes.push({
        startBeat: attack.startBeat,
        durationBeat: assigned.note.durationBeat,
        pitch: voicing[assigned.voiceIndex],
        velocity: assigned.note.velocity,
        barIndex: attack.barIndex,
        voiceIndex: assigned.voiceIndex,
        sourceAttackId: attack.sourceId,
      });
    }
  }

  const unique = new Map<string, GrooveNote>();
  for (const note of notes) {
    const key = `${note.startBeat.toFixed(8)}:${note.pitch}`;
    const previous = unique.get(key);
    if (!previous) {
      unique.set(key, note);
      continue;
    }
    unique.set(key, {
      ...previous,
      durationBeat: Math.max(previous.durationBeat, note.durationBeat),
      velocity: Math.max(previous.velocity, note.velocity),
    });
  }
  return [...unique.values()].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledLabels(progressionId: string): string[] {
  const labels = [...LABELS];
  const random = mulberry32(
    20260815 + [...progressionId].reduce((sum, char) => sum + char.charCodeAt(0) * 31, 0),
  );
  for (let i = labels.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return labels;
}

export function buildGrooveCandidates(
  take: TeacherTake,
  phraseVariationTake: TeacherTake = take,
): GrooveCandidate[] {
  const repeated = teacherTimelineRepeat(take);
  const actualTeacher = teacherPhraseVariation(take, phraseVariationTake);
  const controlChanges = repeatedTeacherPedal(take);
  const candidates: GrooveCandidate[] = [];

  for (const progression of GROOVE_PROGRESSIONS) {
    const labels = shuffledLabels(progression.id);
    GROOVE_CANDIDATE_STRATEGIES.forEach((strategy, index) => {
      const timeline = strategy.build(repeated, actualTeacher, take);
      const notes = realizeTimeline(timeline, progression);
      candidates.push({
        id: `${progression.id}-${strategy.type}`,
        progressionId: progression.id,
        blindLabel: labels[index],
        type: strategy.type,
        bpm: 70,
        totalBeats: 32,
        chordSymbols: progression.chordSymbols,
        fixedVoicings: progression.fixedVoicings,
        notes,
        controlChanges: controlChanges.map((cc) => ({ ...cc })),
        features: extractGrooveFeatures(notes, controlChanges),
      });
    });
  }
  return candidates;
}

export function grooveLabelToIdMap(
  candidates: readonly GrooveCandidate[],
  progressionId: GrooveProgression['id'],
): Record<string, string> {
  return Object.fromEntries(
    candidates
      .filter((candidate) => candidate.progressionId === progressionId)
      .map((candidate) => [candidate.blindLabel, candidate.id]),
  );
}
