import type { SegOption } from '@/components/controls';
import type { VoicingPosition } from '@/lib/performance/baseVoicing';

/**
 * Which inversions the editor offers, and what they are called.
 *
 * The engine still understands all three positions in {@link VoicingPosition}; this is
 * the shorter list a player is asked to choose from. Second inversion was withdrawn
 * from the picker after measuring the three against each other on the golden corpus:
 * first inversion put the bass below E2 half as often (10 chords vs 14), reshaped the
 * chord rather than only its bass more often (36 of 46 vs 32), and left more gate-clean
 * candidates to choose from. Two options that both earn their place beat three where one
 * is the weakest on every axis.
 *
 * Nothing is migrated. A chord saved with `second` keeps sounding exactly as it did, and
 * the picker grows a third button for that chord alone so its state is never misreported
 * — see {@link voicingPositionOptions}.
 */
export const OFFERED_VOICING_POSITIONS: readonly VoicingPosition[] = ['root', 'first'];

export const VOICING_POSITION_LABELS: Record<VoicingPosition, string> = {
  root: '基本形',
  first: '1st',
  second: '2nd',
};

/**
 * Picker options for a chord currently on `position`. Normally the offered pair; for a
 * chord still holding a withdrawn position, that position is appended so the control
 * shows the truth. Moving off it makes the extra button disappear.
 */
export function voicingPositionOptions(position: VoicingPosition): SegOption[] {
  const positions = OFFERED_VOICING_POSITIONS.includes(position)
    ? OFFERED_VOICING_POSITIONS
    : [...OFFERED_VOICING_POSITIONS, position];
  return positions.map((key) => ({ key, label: VOICING_POSITION_LABELS[key] }));
}

/** Card suffix for a non-default position; empty for the default, which needs no badge. */
export function voicingPositionBadge(position: VoicingPosition): string {
  return position === 'root' ? '' : VOICING_POSITION_LABELS[position];
}
