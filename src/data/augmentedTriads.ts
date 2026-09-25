import { degreeLabelFromOffset, noteAt } from '@/data/music';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { KeyMode, LibraryChord, MajorKey } from '@/types';

/**
 * Palette Pro augmented triads for all 12 chromatic roots in the selected key.
 *
 * The Theory catalog already owns `aug / [0, 4, 8]`. This module only exposes
 * that existing definition to the advanced library; it does not redefine harmony.
 * `function` remains the card model's required visual accent; `category` and the
 * AUG badge are the semantic UI authority because augmented function is contextual.
 */
export function augmentedTriads(key: MajorKey, mode: KeyMode): LibraryChord[] {
  return Array.from({ length: 12 }, (_, rootOffset) => {
    const root = noteAt(key, rootOffset, mode);
    return {
      id: `augmented-triad-${key}-${mode}-${rootOffset}`,
      displayName: `${root}aug`,
      degreeLabel: `${degreeLabelFromOffset(rootOffset)}aug`,
      function: 'tonic',
      subLabel: '増三和音',
      badgeLabel: 'AUG',
      category: 'augmentedTriad',
      isPro: true,
      rootOffset,
      suffix: 'aug',
      definitionId: definitionIdForSuffix('aug'),
    };
  });
}
