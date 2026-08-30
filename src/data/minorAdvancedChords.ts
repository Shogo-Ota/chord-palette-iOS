import { keyDisplayName, noteAt } from '@/data/music';
import { DOMINANT_TENSION_UNIVERSE, type TensionToken } from '@/lib/musicTheory';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { LibraryChord, MajorKey } from '@/types';

/**
 * The primary dominant that natural minor deliberately does not contain.
 *
 * The basic seven cards stay exactly natural minor (`v` is minor). This separate
 * advanced group raises scale degree 7 through the V chord, producing the strong
 * harmonic-minor V7→i resolution documented by the theory DB. Its basic minor-key
 * dominant tensions are ♭9 and ♭13; secondary dominants and reverse modal mixture are
 * intentionally absent because the imported DB does not provide minor-key tables for
 * those families.
 */
const DOMINANT_TENSION_SUFFIX: Partial<Record<TensionToken, string>> = {
  b9: '7(♭9)',
  b13: '7(♭13)',
};

const MINOR_DOMINANT_FORMS = [
  { id: 'v7', suffix: '7', degreeLabel: 'V7', subLabel: 'ハーモニック・マイナー' },
  ...DOMINANT_TENSION_UNIVERSE.basicMinorKey.map((tension) => {
    const suffix = DOMINANT_TENSION_SUFFIX[tension];
    if (!suffix) throw new Error(`No dominant suffix for minor-key tension ${tension}`);
    const label = tension.replace('b', '♭');
    return {
      id: `v7-${tension}`,
      suffix,
      degreeLabel: `V7(${label})`,
      subLabel: label,
    };
  }),
];

export function minorPrimaryDominants(key: MajorKey): LibraryChord[] {
  const dominantRoot = noteAt(key, 7, 'minor');
  const tonic = keyDisplayName(key, 'minor');

  return MINOR_DOMINANT_FORMS.map((form) => ({
    id: `minor-primary-dominant-${key}-${form.id}`,
    displayName: `${dominantRoot}${form.suffix}`,
    degreeLabel: form.degreeLabel,
    function: 'dominant',
    subLabel: `${form.subLabel} → ${tonic}m`,
    category: 'primaryDominant',
    isPro: true,
    rootOffset: 7,
    suffix: form.suffix,
    definitionId: definitionIdForSuffix(form.suffix),
  }));
}
