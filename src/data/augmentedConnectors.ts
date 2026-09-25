import { chordPitchClasses, pitchClassSetKey } from '@/data/chordPitchClassSet';
import { diatonicTriads, noteAtDegree } from '@/data/music';
import { definitionIdForSuffix } from '@/lib/theory/definitions';
import type { KeyMode, LibraryChord, MajorKey } from '@/types';

/**
 * Augmented triads offered as a chromatic connector rather than as a chord type.
 *
 * The technique is one move: take a diatonic degree, raise its fifth a semitone, and
 * let that raised fifth continue up another semitone into a tone of the next chord.
 * In C that is `C → Caug → F`, where G rises to G# and then to A. So a candidate is
 * only worth showing when it can name where it goes.
 *
 * Every candidate is spelled from the degree root as root + major 3rd + augmented
 * 5th, so the card always reads `Caug` / `Daug` / `Faug`. `Dm#5` and `Em#5` name the
 * same pitches but ask the player to think about an altered minor chord, which is not
 * what this technique is.
 *
 * Generation and display are separate on purpose. Generation covers every
 * non-diminished degree; the tab shows only what survives.
 */

/** How many candidates the tab may show, however many the key can generate. */
export const AUGMENTED_CONNECTOR_DISPLAY_LIMIT = 3;

/** Semitones from a root to its augmented fifth. */
const AUGMENTED_FIFTH = 8;

/** The strongest root motion in tonal music, and the first target we look for. */
const PERFECT_FOURTH = 5;

export interface AugmentedConnector {
  chord: LibraryChord;
  /** Degree index the augmented triad is built on. */
  sourceDegreeIndex: number;
  /** Degree index it resolves into. */
  targetDegreeIndex: number;
  /** Pitch class of the raised fifth, relative to the tonic. */
  raisedFifthPitchClass: number;
  /** Pitch class it rises into — always a tone of the target chord. */
  resolutionPitchClass: number;
  /** Tones the augmented triad already shares with its target. */
  sharedWithTarget: number;
}

/** What the player is currently working on, when the editor knows. */
export interface AugmentedConnectorContext {
  /** Degrees present in the progression, in order. A degree may repeat. */
  progressionDegrees: readonly number[];
  /** Degree of the selected chord, or a negative value when nothing is selected. */
  selectedDegree: number;
}

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

type Triad = ReturnType<typeof diatonicTriads>[number];

/**
 * A diminished degree is neither a source nor a target: raising the fifth of a
 * diminished triad is not this technique, and resolving a chromatic line onto a
 * diminished chord does not read as an arrival.
 */
function connectableDegrees(triads: readonly Triad[]): number[] {
  return triads
    .map((triad, index) => ({ triad, index }))
    .filter(({ triad }) => triad.suffix !== 'dim')
    .map(({ index }) => index);
}

/**
 * Which chord the raised fifth hands off to.
 *
 * A perfect fourth above the source is preferred, because that root motion is what
 * the ear expects to hear resolve. When the degree a fourth up cannot take the
 * resolution — it may be diminished, or simply not contain the note — the smoothest
 * arrival wins instead: the eligible chord sharing the most tones with the augmented
 * triad. That second clause is what sends `Faug` to `Dm` rather than to `G`.
 */
function resolveTarget(
  triads: readonly Triad[],
  eligible: readonly number[],
  sourceRootOffset: number,
  augmentedPitchClasses: readonly number[],
  resolutionPitchClass: number,
): { degreeIndex: number; sharedWithTarget: number } | undefined {
  const holdsResolution = (index: number) =>
    chordPitchClasses(triads[index]!).includes(resolutionPitchClass);
  const shared = (index: number) =>
    chordPitchClasses(triads[index]!).filter((pitchClass) =>
      augmentedPitchClasses.includes(pitchClass),
    ).length;

  const fourthUp = eligible.find(
    (index) => triads[index]!.rootOffset === wrap(sourceRootOffset + PERFECT_FOURTH),
  );
  if (fourthUp != null && holdsResolution(fourthUp)) {
    return { degreeIndex: fourthUp, sharedWithTarget: shared(fourthUp) };
  }

  const smoothest = [...eligible]
    .filter(holdsResolution)
    .sort((a, b) => shared(b) - shared(a) || a - b)[0];
  return smoothest == null
    ? undefined
    : { degreeIndex: smoothest, sharedWithTarget: shared(smoothest) };
}

function buildConnector(
  key: MajorKey,
  mode: KeyMode,
  triads: readonly Triad[],
  eligible: readonly number[],
  sourceDegreeIndex: number,
): AugmentedConnector | undefined {
  const source = triads[sourceDegreeIndex]!;
  const raisedFifthPitchClass = wrap(source.rootOffset + AUGMENTED_FIFTH);
  const resolutionPitchClass = wrap(raisedFifthPitchClass + 1);
  const augmentedPitchClasses = [
    source.rootOffset,
    wrap(source.rootOffset + 4),
    raisedFifthPitchClass,
  ];

  const target = resolveTarget(
    triads,
    eligible.filter((index) => index !== sourceDegreeIndex),
    source.rootOffset,
    augmentedPitchClasses,
    resolutionPitchClass,
  );
  if (!target) return undefined;

  const root = noteAtDegree(key, sourceDegreeIndex, 0, mode);
  const targetChord = triads[target.degreeIndex]!;
  return {
    chord: {
      id: `augmented-connector-${key}-${mode}-${sourceDegreeIndex}`,
      displayName: `${root}aug`,
      degreeLabel: `${source.degreeLabel}aug`,
      function: source.function,
      subLabel: `→${targetChord.displayName}`,
      badgeLabel: 'AUG',
      category: 'augmentedTriad',
      isPro: true,
      rootOffset: source.rootOffset,
      suffix: 'aug',
      definitionId: definitionIdForSuffix('aug'),
    },
    sourceDegreeIndex,
    targetDegreeIndex: target.degreeIndex,
    raisedFifthPitchClass,
    resolutionPitchClass,
    sharedWithTarget: target.sharedWithTarget,
  };
}

/**
 * Every connector the key can express, before display limits.
 *
 * Symmetric duplicates are collapsed here rather than filtered later, because which
 * root to keep is a musical decision: of the roots naming one pitch-class set, keep
 * the one whose raised fifth actually lands on a chord tone of a diatonic target. In
 * C that keeps `Caug → F` over `Eaug`, whose raised fifth would have to rise to C#.
 */
export function augmentedConnectors(key: MajorKey, mode: KeyMode): AugmentedConnector[] {
  const triads = diatonicTriads(key, mode);
  const eligible = connectableDegrees(triads);

  const bySet = new Map<string, AugmentedConnector>();
  for (const degreeIndex of eligible) {
    const connector = buildConnector(key, mode, triads, eligible, degreeIndex);
    if (!connector) continue;
    const setKey = pitchClassSetKey(connector.chord);
    const held = bySet.get(setKey);
    if (!held || connector.sharedWithTarget > held.sharedWithTarget) bySet.set(setKey, connector);
  }
  return [...bySet.values()].sort((a, b) => a.sourceDegreeIndex - b.sourceDegreeIndex);
}

/**
 * How well a connector fits what the player is actually writing.
 *
 * Fit beats theory here: a connector whose source is the selected chord and whose
 * target is the chord right after it is the one the player can use on this tap, so it
 * outranks a textbook V+ that has nowhere to go in this progression.
 */
function contextScore(
  connector: AugmentedConnector,
  context: AugmentedConnectorContext | undefined,
): number {
  if (!context) return 0;
  const { progressionDegrees, selectedDegree } = context;
  let score = 0;
  if (connector.sourceDegreeIndex === selectedDegree) score += 8;
  if (progressionDegrees.includes(connector.sourceDegreeIndex)) score += 4;
  if (progressionDegrees.includes(connector.targetDegreeIndex)) score += 2;
  const leadsIntoTheNextChord = progressionDegrees.some(
    (degree, index) =>
      degree === connector.sourceDegreeIndex &&
      progressionDegrees[index + 1] === connector.targetDegreeIndex,
  );
  if (leadsIntoTheNextChord) score += 6;
  return score;
}

/**
 * How clearly a connector resolves, used to order candidates when the progression
 * says nothing. Landing on the tonic is the clearest arrival; after that, sharing
 * more tones with the target means less of the chord has to move.
 */
function resolutionScore(connector: AugmentedConnector): number {
  return (connector.targetDegreeIndex === 0 ? 4 : 0) + connector.sharedWithTarget;
}

/**
 * The connectors the tab shows: at most three, best fit first.
 *
 * Padding the row is not a goal. A key and a progression that support one connector
 * get one card, and a progression that supports none gets an empty group, which is a
 * truer answer than three chords the player has no use for.
 */
export function augmentedConnectorCards(
  key: MajorKey,
  mode: KeyMode,
  context?: AugmentedConnectorContext,
): LibraryChord[] {
  return augmentedConnectors(key, mode)
    .map((connector) => ({
      connector,
      score: contextScore(connector, context) + resolutionScore(connector),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.connector.sourceDegreeIndex - b.connector.sourceDegreeIndex,
    )
    .slice(0, AUGMENTED_CONNECTOR_DISPLAY_LIMIT)
    .map(({ connector }) => connector.chord);
}
