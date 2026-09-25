import {
  chromaticMediantChords,
  passingDiminishedChords,
  substituteChords,
} from '@/data/advancedHarmonyChords';
import { augmentedTriads } from '@/data/augmentedTriads';
import { secondaryDominants } from '@/data/music';
import { minorPrimaryDominants } from '@/data/minorAdvancedChords';
import type { KeyMode, LibraryChord, MajorKey } from '@/types';

/** A titled row in the editor's 応用 tab. */
export interface AdvancedLibraryGroup {
  id: string;
  title: string;
  subtitle: string;
  chords: LibraryChord[];
}

/**
 * Mode-specific advanced harmony provider.
 *
 * The screen renders groups and does not decide theory. Major exposes practical
 * non-diatonic palettes. Minor stays conservative: the sourced primary dominant,
 * the mode-independent tritone substitute, and the approved tonic augmented triad,
 * without inventing missing minor tables.
 */
export function advancedLibraryGroups(key: MajorKey, mode: KeyMode): AdvancedLibraryGroup[] {
  if (mode === 'minor') {
    return [
      {
        id: 'minor-primary-dominant',
        title: 'MINOR DOMINANT',
        subtitle: 'マイナー・ドミナント（V7→i）',
        chords: minorPrimaryDominants(key),
      },
      {
        id: 'substitute-chord',
        title: 'SUBSTITUTE CHORD',
        subtitle: '代理コード',
        chords: substituteChords(key, mode),
      },
      {
        id: 'augmented-triad',
        title: 'AUGMENTED TRIAD',
        subtitle: '増三和音（Root・Major 3rd・Augmented 5th）',
        chords: augmentedTriads(key, mode),
      },
    ];
  }

  return [
    {
      id: 'secondary-dominant',
      title: 'SECONDARY DOMINANT',
      subtitle: 'セカンダリードミナント（副属和音）',
      chords: secondaryDominants(key),
    },
    {
      id: 'passing-diminished',
      title: 'PASSING DIMINISHED',
      subtitle: 'パッシングディミニッシュ（経過dim）',
      chords: passingDiminishedChords(key),
    },
    {
      id: 'substitute-chord',
      title: 'SUBSTITUTE CHORD',
      subtitle: '代理コード',
      chords: substituteChords(key, mode),
    },
    {
      id: 'chromatic-mediant',
      title: 'CHROMATIC MEDIANT',
      subtitle: 'クロマチック・メディアント（3度関係の色彩コード）',
      chords: chromaticMediantChords(key),
    },
    {
      id: 'augmented-triad',
      title: 'AUGMENTED TRIAD',
      subtitle: '増三和音（Root・Major 3rd・Augmented 5th）',
      chords: augmentedTriads(key, mode),
    },
  ];
}
