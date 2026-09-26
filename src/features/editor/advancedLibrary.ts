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
import { degreeIndexFromRootOffset, modalInterchange, secondaryDominants } from '@/data/music';
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
 * Order the diminished connectors by how well each fits this progression, keeping all
 * of them.
 *
 * An earlier version dropped connectors whose target was not already in the
 * progression, which got the direction of the library backwards: to write
 * `F → G → G#dim → Am` the player needs `G#dim7 → Am` offered *before* `Am` exists.
 * Hiding a connector until its destination is already written means hiding it exactly
 * when it is needed. These four are the curated shortlist, short enough to show whole.
 *
 * Fit is matched by degree, not by name, because the card points at the seventh chord
 * (`→G7`) while the progression may hold the triad (`G`).
 */
function byProgressionFit(
  chords: readonly LibraryChord[],
  mode: KeyMode,
  context: AdvancedLibraryContext | undefined,
): LibraryChord[] {
  if (!context || context.progression.length === 0) return [...chords];
  const degrees = context.progression.map((event) =>
    degreeIndexFromRootOffset(event.rootOffset ?? 0, mode),
  );
  const present = new Set(degrees);
  // The chord after the selected one is where the player is about to insert, so a
  // connector aimed there is the single most useful card on this tap.
  const degreeAfterSelection =
    context.selectedIndex >= 0 ? degrees[context.selectedIndex + 1] : undefined;
  const fit = (chord: LibraryChord): number => {
    const target = passingDiminishedTarget(chord);
    if (target == null) return 0;
    const bridgesAnAdjacentPair = degrees.some((_, index) => degrees[index + 1] === target);
    return (
      (target === degreeAfterSelection ? 4 : 0) +
      (bridgesAnAdjacentPair ? 2 : 0) +
      (present.has(target) ? 1 : 0)
    );
  };
  return chords
    .map((chord, index) => ({ chord, index, score: fit(chord) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ chord }) => chord);
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
      chords: withoutDuplicates(byProgressionFit(passingDiminishedChords(key), mode, context)),
    },
    {
      id: 'substitute-chord',
      title: 'SUBSTITUTE CHORD',
      subtitle: '代理コード',
      chords: withoutDuplicates(substituteChords(key, mode)),
    },
    {
      // Borrowing had no entry point at all: these five chords were defined, priced and
      // categorised, and the only way to place one was to switch the library to minor and
      // take its diatonic iv — which is a different claim. A minor section and a single
      // borrowed chord are two authoring intents, and the tab now offers the second.
      id: 'modal-interchange',
      title: 'MODAL INTERCHANGE',
      subtitle: '借用和音（同主調から借りるコード）',
      chords: withoutDuplicates(modalInterchange(key)),
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
