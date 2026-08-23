import { clampVelocity } from '../NoteEvent';
import type { FullVoicingNote } from '../chordComping';

export type NaturalAttackVelocityShape = {
  /** Absolute velocity for selected left-hand notes. */
  left?: number;
  /** Absolute low-to-high envelope, resampled to the selected right-hand voice count. */
  rightByAscendingRank?: readonly number[];
};

function resampledVelocity(
  envelope: readonly number[],
  rank: number,
  voiceCount: number,
): number | undefined {
  if (envelope.length === 0) return undefined;
  if (envelope.length === 1 || voiceCount <= 1) return envelope[envelope.length - 1];

  const position = (rank * (envelope.length - 1)) / (voiceCount - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  const low = envelope[lower]!;
  const high = envelope[upper]!;
  return low + (high - low) * fraction;
}

/**
 * Apply a pitch-independent hand/rank envelope after subtractive note selection.
 * The policy changes velocity only; pitch, hand ownership and note count are immutable.
 */
export function velocityForNaturalAttackNote(
  note: FullVoicingNote,
  selectedNotes: readonly FullVoicingNote[],
  fallbackVelocity: number,
  shape?: NaturalAttackVelocityShape,
): number {
  if (!shape) return clampVelocity(fallbackVelocity);
  if (note.handRole === 'LEFT' && shape.left != null) return clampVelocity(shape.left);

  if (note.handRole === 'RIGHT' && shape.rightByAscendingRank) {
    const right = selectedNotes
      .filter((candidate) => candidate.handRole === 'RIGHT')
      .sort((left, rightNote) => left.pitch - rightNote.pitch);
    const rank = right.findIndex((candidate) => candidate.pitch === note.pitch);
    if (rank >= 0) {
      const velocity = resampledVelocity(shape.rightByAscendingRank, rank, right.length);
      if (velocity != null) return clampVelocity(Math.round(velocity));
    }
  }

  return clampVelocity(fallbackVelocity);
}
