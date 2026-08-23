import { applyVoicingMask } from '../chordComping';
import type { FullVoicing, FullVoicingNote, VoicingMask } from '../chordComping';

export type NaturalVoiceRole = 'BASS' | 'RH_BOTTOM' | 'RH_MIDDLE' | 'RH_TOP';

export type NaturalAttackVoicingSelection =
  | {
      kind: 'MASK';
      mask: VoicingMask;
    }
  | {
      kind: 'VOICE_ROLE';
      role: NaturalVoiceRole;
    }
  | {
      kind: 'VOICE_ROLES';
      roles: readonly NaturalVoiceRole[];
    };

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

/**
 * Resolve a style attack from an already completed Shared Base Voicing.
 *
 * This policy is subtractive only: it may retain notes by mask or stable hand
 * rank, but it never creates, moves, doubles or octave-shifts a pitch.
 */
export function selectNaturalAttackNotes(
  voicing: FullVoicing,
  selection: NaturalAttackVoicingSelection,
): FullVoicingNote[] {
  if (selection.kind === 'MASK') {
    return applyVoicingMask(voicing, selection.mask);
  }

  const full = uniqueByPitch(voicing.notes);
  const left = full.filter((note) => note.handRole === 'LEFT');
  const right = full.filter((note) => note.handRole === 'RIGHT');

  const noteForRole = (role: NaturalVoiceRole): FullVoicingNote | undefined => {
    if (role === 'BASS') {
      return left[0] ?? full[0];
    }
    if (right.length === 0) return undefined;
    if (role === 'RH_BOTTOM') return right[0];
    if (role === 'RH_TOP') return right[right.length - 1];
    return right[Math.floor(right.length / 2)];
  };

  if (selection.kind === 'VOICE_ROLES') {
    return uniqueByPitch(
      selection.roles
        .map((role) => noteForRole(role))
        .filter((note): note is FullVoicingNote => note !== undefined),
    );
  }

  if (selection.role === 'BASS') {
    const bass = left[0] ?? full[0];
    return bass ? [bass] : [];
  }
  if (right.length === 0) return [];
  if (selection.role === 'RH_BOTTOM') return [right[0]!];
  if (selection.role === 'RH_TOP') return [right[right.length - 1]!];
  return [right[Math.floor(right.length / 2)]!];
}

export function compatibilityMaskForSelection(
  selection: NaturalAttackVoicingSelection,
): VoicingMask {
  if (selection.kind === 'MASK') return selection.mask;
  if (selection.kind === 'VOICE_ROLES') {
    const hasBass = selection.roles.includes('BASS');
    const hasRight = selection.roles.some((role) => role !== 'BASS');
    if (hasBass && hasRight) return 'SHELL';
    return hasBass ? 'ROOT_ONLY' : 'UPPER';
  }
  return selection.role === 'BASS' ? 'ROOT_ONLY' : 'UPPER';
}
