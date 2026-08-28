/**
 * Decomposes a shipped chord definition into a theory core quality plus tensions.
 *
 * The two vocabularies do not line up one to one, and that is by design rather than an
 * oversight. `CHORD_CATALOG` ships 48 playable symbols including compounds like `maj9` and
 * `13(♭9)`; the theory database holds 16 *core* qualities. So `maj9` is not a quality, it is
 * `maj7` plus a 9th, and this resolver is the only place that says so.
 *
 * Nothing here reads or writes pitch for playback. It answers "what is this chord, in the
 * book's terms", which is the prerequisite for asking about available tensions or avoid
 * notes later. Resolution is total and reports failure explicitly: a symbol the theory
 * database cannot express returns `null` rather than a nearest guess, because a wrong
 * quality would silently authorise wrong tensions.
 *
 * ## How a core is chosen
 *
 * A quality is a candidate when every degree it *requires* is present. Required means the
 * formula's degrees minus the ones the book says a voicing may normally drop — so `7alt`,
 * which ships without a 5th, still resolves as a dominant 7th rather than failing.
 *
 * Whatever the core does not account for must be expressible entirely as tension tokens. A
 * leftover major 7th is not a tension, which is what stops `maj9` resolving as `add9` plus
 * a stray 11 semitones.
 *
 * The catalog's own `quality` field narrows the search before any of that. `m(add11)` and
 * `sus4(#9)` are the same five pitch classes, so pitch content alone cannot separate them;
 * the catalog already declares one of them minor, and ignoring that declaration in favour
 * of a heuristic would be choosing to know less than we do.
 */

import {
  CHORD_QUALITIES,
  CHORD_FORMULAS,
  TENSION_TOKENS,
  TENSION_TO_SEMITONE,
  degreePitchClasses,
  type ChordFormula,
  type ChordQuality,
  type TensionToken,
} from '@/lib/musicTheory';
import type { ChordDefinition, ChordQuality as CatalogQuality } from '@/lib/theory/definitions';

export type ResolvedChordDefinition = {
  definitionId: string;
  symbol: string;
  /** The core quality in the theory database's vocabulary. */
  quality: ChordQuality;
  formula: ChordFormula;
  /** Core pitch classes the definition actually sounds, root-relative and ascending. */
  corePitchClasses: readonly number[];
  /** Core degrees the definition omits, which the book permits. */
  omittedDegrees: readonly string[];
  /** Everything above the core, as tensions. */
  tensions: readonly TensionToken[];
};

/** Why a definition could not be expressed in the theory database's terms. */
export type UnresolvedChordDefinition = {
  definitionId: string;
  symbol: string;
  catalogQuality: CatalogQuality;
  pitchClasses: readonly number[];
  reason: 'NO_CORE_QUALITY_MATCHES' | 'REMAINDER_IS_NOT_TENSIONS';
  /** Qualities whose required degrees were present but whose remainder was not tensions. */
  rejectedCores: readonly ChordQuality[];
};

/**
 * Which theory qualities a catalog quality may resolve to. This is a narrowing, not a
 * mapping: `dominant` admits both `7` and `7sus4` because `11` ships as a suspended
 * dominant, and only the pitch content separates them.
 */
const QUALITY_FAMILIES: Record<CatalogQuality, readonly ChordQuality[]> = {
  major: ['maj', 'maj7', 'maj6', 'add9'],
  minor: ['min', 'min7', 'minMaj7', 'min6', 'minAdd9'],
  dominant: ['7', '7sus4'],
  diminished: ['dim', 'dim7'],
  halfDim: ['min7b5'],
  augmented: ['aug'],
  suspended: ['sus4', '7sus4'],
  other: CHORD_QUALITIES,
};

const SEMITONE_TO_TENSION = new Map<number, TensionToken>(
  TENSION_TOKENS.map((tension) => [TENSION_TO_SEMITONE[tension], tension]),
);

function pitchClassesOf(intervals: readonly number[]): number[] {
  return [...new Set(intervals.map((interval) => ((interval % 12) + 12) % 12))].sort(
    (a, b) => a - b,
  );
}

/** Degrees the book does not allow a voicing to drop. */
function requiredPitchClasses(formula: ChordFormula): number[] {
  const omittable = new Set(formula.normallyOmittableDegrees);
  return degreePitchClasses(formula.degrees.filter((degree) => !omittable.has(degree)));
}

type CoreMatch = {
  quality: ChordQuality;
  formula: ChordFormula;
  corePitchClasses: number[];
  omittedDegrees: string[];
  tensions: TensionToken[];
};

function matchCore(formula: ChordFormula, pitchClasses: readonly number[]): CoreMatch | null {
  const present = new Set(pitchClasses);
  if (!requiredPitchClasses(formula).every((pc) => present.has(pc))) return null;

  const formulaPcs = new Set(degreePitchClasses(formula.degrees));
  const remainder = [...pitchClasses].filter((pc) => !formulaPcs.has(pc));
  const tensions: TensionToken[] = [];
  for (const pc of remainder) {
    const tension = SEMITONE_TO_TENSION.get(pc);
    if (!tension) return null;
    tensions.push(tension);
  }

  return {
    quality: formula.quality,
    formula,
    corePitchClasses: degreePitchClasses(formula.degrees).filter((pc) => present.has(pc)),
    omittedDegrees: formula.degrees.filter(
      (degree) => !present.has(degreePitchClasses([degree])[0]!),
    ),
    tensions,
  };
}

/**
 * Ranks by how much of the chord the core accounts for, so a fuller core beats a thinner
 * one plus more tensions.
 *
 * Ties break on declaration order in `CHORD_QUALITIES`, which runs triads, sevenths,
 * sixths, sus, then add. That ordering is load-bearing rather than incidental: `6/9` is a
 * sixth chord with a ninth, not an add9 chord with a thirteenth, and `add` ranking last
 * encodes that `add` is the weakest claim a symbol can make on a pitch.
 */
function preferFullerCore(left: CoreMatch, right: CoreMatch): number {
  const byCoreSize = right.corePitchClasses.length - left.corePitchClasses.length;
  if (byCoreSize !== 0) return byCoreSize;
  return CHORD_QUALITIES.indexOf(left.quality) - CHORD_QUALITIES.indexOf(right.quality);
}

export function resolveChordDefinition(
  definition: ChordDefinition,
): ResolvedChordDefinition | UnresolvedChordDefinition {
  const pitchClasses = pitchClassesOf(definition.intervals);
  const family = QUALITY_FAMILIES[definition.quality];

  const rejectedCores: ChordQuality[] = [];
  const matches: CoreMatch[] = [];
  for (const quality of family) {
    const formula = CHORD_FORMULAS[quality];
    const match = matchCore(formula, pitchClasses);
    if (match) {
      matches.push(match);
      continue;
    }
    if (requiredPitchClasses(formula).every((pc) => pitchClasses.includes(pc))) {
      rejectedCores.push(quality);
    }
  }

  if (matches.length === 0) {
    return {
      definitionId: definition.id,
      symbol: definition.symbol,
      catalogQuality: definition.quality,
      pitchClasses,
      reason: rejectedCores.length > 0 ? 'REMAINDER_IS_NOT_TENSIONS' : 'NO_CORE_QUALITY_MATCHES',
      rejectedCores,
    };
  }

  const best = [...matches].sort(preferFullerCore)[0]!;
  return {
    definitionId: definition.id,
    symbol: definition.symbol,
    quality: best.quality,
    formula: best.formula,
    corePitchClasses: best.corePitchClasses,
    omittedDegrees: best.omittedDegrees,
    tensions: best.tensions,
  };
}

export function isResolved(
  result: ResolvedChordDefinition | UnresolvedChordDefinition,
): result is ResolvedChordDefinition {
  return 'quality' in result;
}

/** Theory qualities no shipped definition resolves to. */
export function qualitiesWithoutDefinition(
  definitions: readonly ChordDefinition[],
): ChordQuality[] {
  const reached = new Set<ChordQuality>();
  for (const definition of definitions) {
    const result = resolveChordDefinition(definition);
    if (isResolved(result) && result.tensions.length === 0 && result.omittedDegrees.length === 0) {
      reached.add(result.quality);
    }
  }
  return CHORD_QUALITIES.filter((quality) => !reached.has(quality));
}
