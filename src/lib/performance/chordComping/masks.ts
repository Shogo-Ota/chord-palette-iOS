import { kindOfDegree } from '../humanTemplate/degreeRoles';
import type { FullVoicing, FullVoicingNote, VoicingMask } from './types';

function uniqueByPitch(notes: readonly FullVoicingNote[]): FullVoicingNote[] {
  const seen = new Set<number>();
  return [...notes]
    .sort((left, right) => left.pitch - right.pitch)
    .filter((note) => {
      if (seen.has(note.pitch)) return false;
      seen.add(note.pitch);
      return true;
    });
}

function firstDegree(
  notes: readonly FullVoicingNote[],
  degrees: readonly FullVoicingNote['degree'][],
): FullVoicingNote | undefined {
  return notes.find((note) => !note.isDuplicate && degrees.includes(note.degree));
}

/**
 * Subtractive-only mask. Selected notes keep the exact pitch, inversion and hand
 * role of the completed Full Voicing.
 */
export function applyVoicingMask(voicing: FullVoicing, mask: VoicingMask): FullVoicingNote[] {
  const full = uniqueByPitch(voicing.notes);
  const left = full.filter((note) => note.handRole === 'LEFT');
  const right = full.filter((note) => note.handRole === 'RIGHT');
  let selected: FullVoicingNote[];

  switch (mask) {
    case 'FULL':
      selected = full;
      break;
    case 'ROOT_ONLY':
      selected = left;
      break;
    case 'TRIAD': {
      const hasThird = full.some((note) => note.degree === 'third');
      const alreadyCovered = new Set(left.map((note) => note.degree));
      const desired: FullVoicingNote['degree'][] = hasThird
        ? ['root', 'third', 'fifth']
        : ['root', 'ninth', 'eleventh', 'fifth'];
      const body = desired
        .filter((degree) => !alreadyCovered.has(degree))
        .map((degree) => firstDegree(right, [degree]))
        .filter((note): note is FullVoicingNote => note !== undefined);
      selected = [...left, ...body];
      break;
    }
    case 'SHELL': {
      const guideDegrees: FullVoicingNote['degree'][] = full.some((note) => note.degree === 'third')
        ? ['third', 'seventh']
        : ['ninth', 'eleventh', 'seventh'];
      const covered = new Set(left.map((note) => note.degree));
      const guides = guideDegrees
        .filter((degree) => !covered.has(degree))
        .map((degree) => firstDegree(right, [degree]))
        .filter((note): note is FullVoicingNote => note !== undefined);
      const fallback =
        guides.length === 0
          ? firstDegree(right, ['third', 'ninth', 'eleventh', 'root'])
          : undefined;
      selected = [...left, ...guides, ...(fallback ? [fallback] : [])];
      break;
    }
    case 'UPPER': {
      const upper = right.filter((note) => note.degree !== 'root');
      selected = upper.length ? upper : right;
      break;
    }
  }

  return uniqueByPitch(selected);
}

export function maskContainsColor(voicing: FullVoicing, mask: VoicingMask): boolean {
  return applyVoicingMask(voicing, mask).some((note) => kindOfDegree(note.degree) === 'color');
}
