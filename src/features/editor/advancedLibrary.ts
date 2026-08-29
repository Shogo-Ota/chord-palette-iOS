import { modalInterchange, secondaryDominants } from '@/data/music';
import { minorPrimaryDominants } from '@/data/minorAdvancedChords';
import type { KeyMode, LibraryChord, MajorKey } from '@/types';

/** A titled row in the editor's 応用 tab. */
export interface AdvancedLibraryGroup {
  id: string;
  title: string;
  chords: LibraryChord[];
}

/**
 * Mode-specific advanced harmony provider.
 *
 * The screen renders groups and does not decide theory. Major preserves its existing
 * secondary-dominant / modal-interchange inventory. Minor exposes only the primary
 * harmonic-minor dominant family explicitly supported by the theory DB.
 */
export function advancedLibraryGroups(key: MajorKey, mode: KeyMode): AdvancedLibraryGroup[] {
  if (mode === 'minor') {
    return [
      {
        id: 'minor-primary-dominant',
        title: 'MINOR DOMINANT',
        chords: minorPrimaryDominants(key),
      },
    ];
  }

  return [
    {
      id: 'secondary-dominant',
      title: 'SECONDARY DOMINANT',
      chords: secondaryDominants(key),
    },
    {
      id: 'modal-interchange',
      title: 'MODAL INTERCHANGE',
      chords: modalInterchange(key),
    },
  ];
}
