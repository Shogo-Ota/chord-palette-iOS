import { diatonicSevenths, diatonicTriads, noteAtDegree } from '@/data/music';
import {
  getSubstituteDominantRoot,
  MAJOR_BACKDOOR_DOMINANT_PALETTE,
  MAJOR_CHROMATIC_MEDIANT_PALETTE,
  MAJOR_PASSING_DIMINISHED_PALETTE,
  type PassingDiminishedPaletteRule,
} from '@/lib/musicTheory';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { ChordRootSpelling, KeyMode, LibraryChord, MajorKey } from '@/types';

function rootSpelling(degreeIndex: number, alteration: -1 | 0 | 1): ChordRootSpelling {
  return { degreeIndex, alteration };
}

/** The id every passing-diminished card carries, and the rule it was built from. */
export function passingDiminishedRuleForChordId(
  chordId: string | undefined,
): PassingDiminishedPaletteRule | undefined {
  if (!chordId) return undefined;
  return MAJOR_PASSING_DIMINISHED_PALETTE.find((rule) => chordId.endsWith(`-${rule.id}`));
}

/**
 * Four practical major-key diminished connectors, in UI priority order.
 *
 * Each one states its own harmonic function. Copying the target's function was wrong in a
 * way worth recording: it made `#V°7` a tonic, because the `vi` it resolves into is one,
 * which told the player that the hardest pull in the progression was a chord of rest.
 */
export function passingDiminishedChords(key: MajorKey): LibraryChord[] {
  const targets = diatonicSevenths(key, 'major');
  return MAJOR_PASSING_DIMINISHED_PALETTE.map((rule) => {
    const spelling = rootSpelling(rule.rootSpelling.degreeIndex, rule.rootSpelling.alteration);
    const root = noteAtDegree(key, spelling.degreeIndex, spelling.alteration, 'major');
    const target = targets[rule.targetDegreeIndex]!;
    return {
      id: `passing-diminished-${key}-${rule.id}`,
      displayName: `${root}dim7`,
      degreeLabel: rule.degreeLabel,
      function: rule.harmonicFunction,
      subLabel: `→${target.displayName}`,
      badgeLabel: 'DIM',
      category: 'passingDiminished',
      isPro: true,
      rootOffset: rule.rootOffset,
      rootSpelling: spelling,
      suffix: 'dim7',
      definitionId: definitionIdForSuffix('dim7'),
    };
  });
}

/**
 * Dominant substitutions supported by the current theory model.
 * Major gets SubV7 and backdoor; minor conservatively gets SubV7 only.
 */
export function substituteChords(key: MajorKey, mode: KeyMode): LibraryChord[] {
  const tonic =
    mode === 'major'
      ? diatonicSevenths(key, 'major')[0]!.displayName
      : diatonicTriads(key, 'minor')[0]!.displayName;
  const subVSpelling = rootSpelling(1, -1);
  const subVRoot = noteAtDegree(key, subVSpelling.degreeIndex, subVSpelling.alteration, mode);
  const chords: LibraryChord[] = [
    {
      id: `substitute-${key}-${mode}-sub-v`,
      displayName: `${subVRoot}7`,
      degreeLabel: 'SubV7',
      function: 'dominant',
      subLabel: `→${tonic}`,
      commonName: '裏コード',
      category: 'substituteChord',
      isPro: true,
      rootOffset: getSubstituteDominantRoot(7),
      rootSpelling: subVSpelling,
      suffix: '7',
      definitionId: definitionIdForSuffix('7'),
    },
  ];

  if (mode === 'minor') return chords;

  const backdoor = MAJOR_BACKDOOR_DOMINANT_PALETTE;
  const backdoorSpelling = rootSpelling(
    backdoor.rootSpelling.degreeIndex,
    backdoor.rootSpelling.alteration,
  );
  const backdoorRoot = noteAtDegree(
    key,
    backdoorSpelling.degreeIndex,
    backdoorSpelling.alteration,
    'major',
  );
  chords.push({
    id: `substitute-${key}-major-${backdoor.id}`,
    displayName: `${backdoorRoot}7`,
    degreeLabel: backdoor.degreeLabel,
    function: 'dominant',
    subLabel: `→${tonic}`,
    commonName: 'バックドア',
    category: 'substituteChord',
    isPro: true,
    rootOffset: backdoor.rootOffset,
    rootSpelling: backdoorSpelling,
    suffix: '7',
    definitionId: definitionIdForSuffix('7'),
  });

  return chords;
}

/** Four high-utility major-key chromatic-mediant colours. */
export function chromaticMediantChords(key: MajorKey): LibraryChord[] {
  return MAJOR_CHROMATIC_MEDIANT_PALETTE.map((rule) => {
    const spelling = rootSpelling(rule.rootSpelling.degreeIndex, rule.rootSpelling.alteration);
    const root = noteAtDegree(key, spelling.degreeIndex, spelling.alteration, 'major');
    return {
      id: `chromatic-mediant-${key}-${rule.id}`,
      displayName: `${root}maj7`,
      degreeLabel: rule.degreeLabel,
      function: 'tonic',
      badgeLabel: 'COLOR',
      category: 'chromaticMediant',
      isPro: true,
      rootOffset: rule.rootOffset,
      rootSpelling: spelling,
      suffix: 'maj7',
      definitionId: definitionIdForSuffix('maj7'),
    };
  });
}
