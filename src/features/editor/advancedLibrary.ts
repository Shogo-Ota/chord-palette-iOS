import {
  chromaticMediantChords,
  passingDiminishedChords,
  substituteChords,
} from '@/data/advancedHarmonyChords';
import { MAJOR_PASSING_DIMINISHED_PALETTE } from '@/lib/musicTheory';
import {
  augmentedConnectorCards,
  type AugmentedConnectorContext,
} from '@/data/augmentedConnectors';
import { pitchClassSetKey } from '@/data/chordPitchClassSet';
import { degreeIndexFromRootOffset, secondaryDominants } from '@/data/music';
import { minorPrimaryDominants } from '@/data/minorAdvancedChords';
import type { ChordEvent, KeyMode, LibraryChord, MajorKey } from '@/types';

/** A titled row in the editor's 応用 tab. */
export interface AdvancedLibraryGroup {
  id: string;
  title: string;
  subtitle: string;
  chords: LibraryChord[];
  /** Shown in place of the row when the progression supports no candidate. */
  emptyHint?: string;
}

/** What the player is currently working on. Absent when the editor cannot say. */
export interface AdvancedLibraryContext {
  progression: readonly ChordEvent[];
  /** Index into `progression`, or a negative value when nothing is selected. */
  selectedIndex: number;
}

/**
 * Drop cards that would be the same offer twice.
 *
 * Comparing symbols is not enough. A symmetric chord has several equally correct
 * names, and two spellings of one pitch class — `D♭7` and `C#7` — are the same chord
 * played twice, so the sounding notes and the bass are part of the key.
 *
 * The target is part of it too, and that matters most for diminished sevenths, which
 * are symmetric four ways: `E♭dim7` and `F#dim7` are the same four notes, but one
 * leads to `Dm` and the other to `G`. Same notes with the same destination is a
 * duplicate; same notes heading somewhere else is a different technique.
 */
function withoutDuplicates(chords: readonly LibraryChord[]): LibraryChord[] {
  const seen = new Set<string>();
  return chords.filter((chord) => {
    const key = `${pitchClassSetKey(chord)}/${chord.bassOffset ?? ''}/${chord.subLabel ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function augmentedContext(
  mode: KeyMode,
  context: AdvancedLibraryContext | undefined,
): AugmentedConnectorContext | undefined {
  if (!context) return undefined;
  const degreeOf = (event: ChordEvent) =>
    degreeIndexFromRootOffset(event.rootOffset ?? 0, mode);
  const selected = context.progression[context.selectedIndex];
  return {
    progressionDegrees: context.progression.map(degreeOf),
    selectedDegree: selected ? degreeOf(selected) : -1,
  };
}

const AUGMENTED_EMPTY_HINT = 'この進行で使いやすい候補はありません';

/**
 * Which degree each curated diminished connector leads to, keyed by the rule id its
 * card embeds. Read from the palette rather than from card order, so reordering the
 * palette cannot silently mismatch a target.
 */
const PASSING_DIMINISHED_TARGETS: readonly (readonly [string, number])[] =
  MAJOR_PASSING_DIMINISHED_PALETTE.map((rule) => [rule.id, rule.targetDegreeIndex]);

function passingDiminishedTarget(chord: LibraryChord): number | undefined {
  return PASSING_DIMINISHED_TARGETS.find(([ruleId]) => chord.id.endsWith(`-${ruleId}`))?.[1];
}

/**
 * Keep only the diminished connectors that lead somewhere this progression goes.
 *
 * The technique exists to bridge two chords, so one whose target is nowhere in the
 * progression is a chord the player has no use for yet. Matching is by degree, not by
 * name, because the card points at the seventh chord (`→G7`) while the progression may
 * hold the triad (`G`).
 *
 * When nothing matches, the curated shortlist stands rather than emptying a row that
 * still has something to teach — and that shortlist is four connectors, never every
 * diminished seventh.
 */
function reachableTargets(
  chords: readonly LibraryChord[],
  mode: KeyMode,
  context: AdvancedLibraryContext | undefined,
): LibraryChord[] {
  if (!context || context.progression.length === 0) return [...chords];
  const present = new Set(
    context.progression.map((event) => degreeIndexFromRootOffset(event.rootOffset ?? 0, mode)),
  );
  const narrowed = chords.filter((chord) => {
    const target = passingDiminishedTarget(chord);
    return target != null && present.has(target);
  });
  return narrowed.length > 0 ? narrowed : [...chords];
}

/**
 * Mode-specific advanced harmony provider.
 *
 * The screen renders groups and does not decide theory. Major exposes practical
 * non-diatonic palettes. Minor stays conservative: the sourced primary dominant and
 * the mode-independent tritone substitute, without inventing missing minor tables.
 *
 * Every group presents a technique rather than a chord type, which is why each card
 * names the chord it leads to. Chromatic mediants are the one exception: they are a
 * colour, not a departure with a destination.
 *
 * `context` is optional because the tab can be opened before anything is selected. It
 * only ever narrows the offer — there is no candidate that appears because the
 * progression is unknown.
 */
export function advancedLibraryGroups(
  key: MajorKey,
  mode: KeyMode,
  context?: AdvancedLibraryContext,
): AdvancedLibraryGroup[] {
  const augmented: AdvancedLibraryGroup = {
    id: 'augmented-connector',
    title: 'AUGMENTED',
    subtitle: 'オーグメント（半音で次のコードへつなぐ）',
    chords: withoutDuplicates(augmentedConnectorCards(key, mode, augmentedContext(mode, context))),
    emptyHint: AUGMENTED_EMPTY_HINT,
  };

  if (mode === 'minor') {
    return [
      {
        id: 'minor-primary-dominant',
        title: 'MINOR DOMINANT',
        subtitle: 'マイナー・ドミナント（V7→i）',
        chords: withoutDuplicates(minorPrimaryDominants(key)),
      },
      {
        id: 'substitute-chord',
        title: 'SUBSTITUTE CHORD',
        subtitle: '代理コード',
        chords: withoutDuplicates(substituteChords(key, mode)),
      },
      augmented,
    ];
  }

  return [
    {
      id: 'secondary-dominant',
      title: 'SECONDARY DOMINANT',
      subtitle: 'セカンダリードミナント（副属和音）',
      chords: withoutDuplicates(secondaryDominants(key)),
    },
    {
      id: 'passing-diminished',
      title: 'PASSING DIMINISHED',
      subtitle: 'パッシングディミニッシュ（経過dim）',
      chords: withoutDuplicates(reachableTargets(passingDiminishedChords(key), mode, context)),
    },
    {
      id: 'substitute-chord',
      title: 'SUBSTITUTE CHORD',
      subtitle: '代理コード',
      chords: withoutDuplicates(substituteChords(key, mode)),
    },
    {
      id: 'chromatic-mediant',
      title: 'CHROMATIC MEDIANT',
      subtitle: 'クロマチック・メディアント（3度関係の色彩コード）',
      chords: withoutDuplicates(chromaticMediantChords(key)),
    },
    augmented,
  ];
}
