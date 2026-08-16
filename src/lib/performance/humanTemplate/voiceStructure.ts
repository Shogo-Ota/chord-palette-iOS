/**
 * Teacher attack → voice slots. Pitch is discarded; role and spacing remain.
 */

import type { TemplateNote } from '../strictV2';
import { voiceRoleFromLegacy, type VoiceRole } from './degreePitch';
import { classifyInterval, type HarmonicDegree } from './degreeRoles';
import { reconstructTeacherPitch } from './pureTranspose';

export type VoiceSlot = {
  index: number;
  teacherPitch: number;
  role: VoiceRole;
  teacherDegree: HarmonicDegree;
};

export type VoiceLeadingState = {
  pitches: number[];
  roles: VoiceRole[];
  bass: number | null;
  top: number | null;
  center: number | null;
  span: number | null;
  lowest: number | null;
  highest: number | null;
  voiceCount: number;
  /** Last 3+ voice voicing — sparse attacks must not ratchet this. */
  lastFull: {
    pitches: number[];
    bass: number;
    top: number;
    center: number;
    span: number;
  } | null;
};

export function emptyVoiceLeadingState(): VoiceLeadingState {
  return {
    pitches: [],
    roles: [],
    bass: null,
    top: null,
    center: null,
    span: null,
    lowest: null,
    highest: null,
    voiceCount: 0,
    lastFull: null,
  };
}

export function teacherPitchOf(note: TemplateNote): number {
  if (note.intervalFromRoot !== undefined && note.sourceRootPc !== undefined) {
    return reconstructTeacherPitch(note.sourceRootPc, note.intervalFromRoot);
  }
  if (note.relativeOctave !== undefined) {
    return 12 * note.relativeOctave;
  }
  return 60;
}

function rolesByCount(n: number): VoiceRole[] {
  if (n <= 0) return [];
  if (n === 1) return ['top'];
  if (n === 2) return ['bass', 'top'];
  if (n === 3) return ['bass', 'inner', 'top'];
  if (n === 4) return ['bass', 'inner', 'upper', 'top'];
  const mid = n - 2;
  const innerCount = Math.max(1, Math.ceil(mid / 2));
  const roles: VoiceRole[] = ['bass'];
  for (let i = 0; i < mid; i++) roles.push(i < innerCount ? 'inner' : 'upper');
  roles.push('top');
  return roles;
}

export function extractVoiceStructure(notes: readonly TemplateNote[]): VoiceSlot[] {
  const teacher = notes.map(teacherPitchOf);
  const order = notes.map((_, i) => i).sort((a, b) => teacher[a]! - teacher[b]! || a - b);
  const byRank = rolesByCount(order.length);
  return order.map((index, rank) => {
    const note = notes[index]!;
    const compiled = voiceRoleFromLegacy(note);
    const role =
      order.length === 1
        ? teacher[index]! < 48
          ? 'bass'
          : compiled === 'bass'
            ? 'bass'
            : 'top'
        : rank === 0
          ? 'bass'
          : rank === order.length - 1
            ? 'top'
            : compiled === 'upper' || compiled === 'inner'
              ? compiled
              : byRank[rank]!;
    const iv =
      note.intervalFromRoot !== undefined
        ? note.intervalFromRoot
        : teacher[index]! - (note.sourceRootPc ?? 0);
    return {
      index,
      teacherPitch: teacher[index]!,
      role,
      teacherDegree: classifyInterval(iv),
    };
  });
}

export function stateFromPitches(
  pitches: readonly number[],
  roles: readonly VoiceRole[],
): VoiceLeadingState {
  if (pitches.length === 0) return emptyVoiceLeadingState();
  const sorted = [...pitches].sort((a, b) => a - b);
  const lowest = sorted[0]!;
  const highest = sorted[sorted.length - 1]!;
  const center = (lowest + highest) / 2;
  const span = highest - lowest;
  return {
    pitches: sorted,
    roles: [...roles],
    bass: lowest,
    top: highest,
    center,
    span,
    lowest,
    highest,
    voiceCount: pitches.length,
    lastFull:
      pitches.length >= 3
        ? { pitches: sorted, bass: lowest, top: highest, center, span }
        : null,
  };
}

/** Sparse attacks update one role; they must not reset the hand. */
export function mergeVoiceLeadingState(
  prev: VoiceLeadingState,
  pitches: readonly number[],
  roles: readonly VoiceRole[],
): VoiceLeadingState {
  if (pitches.length === 0) return prev;
  if (prev.voiceCount === 0 || pitches.length >= 3) {
    return stateFromPitches(pitches, roles);
  }
  const next: VoiceLeadingState = {
    ...prev,
    pitches: [...prev.pitches],
    roles: [...prev.roles],
    lastFull: prev.lastFull,
  };
  for (let i = 0; i < pitches.length; i++) {
    const role = roles[i]!;
    const pitch = pitches[i]!;
    if (role === 'bass') next.bass = pitch;
    if (role === 'top') next.top = pitch;
  }
  return next;
}
