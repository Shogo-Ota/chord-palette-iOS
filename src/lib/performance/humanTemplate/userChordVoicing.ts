/**
 * DEPRECATED ANALYSIS ONLY: Phase 3A nearest-fit helper. Production uses Shared
 * Base Voicing plus atomic subtractive masks. Kept only for historical unit tests.
 */

import type { AllowedToneSet, TemplateNote } from '../strictV2';
import { reconstructTeacherPitch } from './pureTranspose';

function teacherPitch(note: TemplateNote): number {
  if (note.intervalFromRoot !== undefined && note.sourceRootPc !== undefined) {
    return reconstructTeacherPitch(note.sourceRootPc, note.intervalFromRoot);
  }
  if (note.relativeOctave !== undefined) {
    return 12 * note.relativeOctave;
  }
  return 60;
}

function pickLegalPitch(
  allowed: AllowedToneSet,
  target: number,
  above: number,
  usedMidi: ReadonlySet<number>,
  usedPcs: readonly number[],
): number {
  let best = -1;
  let bestScore = Infinity;
  for (let pitch = above + 1; pitch <= 127; pitch++) {
    if (!allowed.containsPitch(pitch) || usedMidi.has(pitch)) continue;
    const pc = ((pitch % 12) + 12) % 12;
    const coverage = usedPcs.includes(pc) ? 0 : -3;
    const score = Math.abs(pitch - target) + coverage;
    if (score < bestScore) {
      bestScore = score;
      best = pitch;
    }
  }
  if (best >= 0) return best;
  for (let pitch = above + 1; pitch <= 127; pitch++) {
    if (allowed.containsPitch(pitch)) return pitch;
  }
  return Math.min(127, Math.max(0, above + 1));
}

/**
 * Assign one legal MIDI pitch per note in an attack.
 * Order of teacher pitches is kept (no crossing). MIDI numbers are unique.
 */
export function realizeUserChordAttack(
  notes: readonly TemplateNote[],
  allowed: AllowedToneSet,
): number[] {
  if (notes.length === 0) return [];

  const teacher = notes.map(teacherPitch);
  const order = notes.map((_, i) => i).sort((a, b) => teacher[a]! - teacher[b]! || a - b);
  const assigned = new Array<number>(notes.length).fill(0);
  const usedMidi = new Set<number>();
  const usedPcs: number[] = [];

  for (let step = 0; step < order.length; step++) {
    const index = order[step]!;
    const prev = step === 0 ? -1 : assigned[order[step - 1]!]!;
    const target =
      step === 0 ? teacher[index]! : prev + (teacher[index]! - teacher[order[step - 1]!]!);
    const pitch = pickLegalPitch(allowed, target, prev, usedMidi, usedPcs);
    assigned[index] = pitch;
    usedMidi.add(pitch);
    usedPcs.push(((pitch % 12) + 12) % 12);
  }

  return assigned;
}
