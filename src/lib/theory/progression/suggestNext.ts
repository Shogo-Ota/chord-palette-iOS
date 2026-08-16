/**
 * Next-chord suggestion (pure, UI/RN/Expo/native-independent) — the "what sounds good
 * next" brain of the one-tap experience. Given the current progression and key, it
 * returns ranked chord candidates so a user who knows no theory can keep building a
 * progression that resolves nicely.
 *
 * It does NOT copy any specific song. It applies GENERAL functional-harmony theory:
 *  - Function pull: Tonic → Subdominant/Dominant, Subdominant → Dominant, Dominant → Tonic.
 *  - Common "定番" progressions expressed as degree templates (I–V–vi–IV, ii–V–I, the
 *    royal-road 4536, 50s I–vi–IV–V, canon…), matched against the tail of what's there.
 *  - Cadence pull near a phrase end (V→I).
 *  - Pro tier additionally offers borrowed (modal-interchange) and secondary-dominant
 *    colours; free tier stays on basic diatonic chords + the standard progressions.
 *
 * Determinism (design §1): no `Math.random`. Candidates are scored by a fixed function
 * and sorted deterministically, so the same input always yields the same ranking.
 */

import {
  degreeIndexFromRootOffset,
  diatonicTriads,
  modalInterchange,
  secondaryDominants,
} from '@/data/music';
import type { ChordDuration, ChordEvent, ChordFunction, MajorKey } from '@/types';

/** Why a chord was suggested (drives an optional UI hint / ordering). */
export type SuggestionReason =
  | 'start'
  | 'functional'
  | 'template'
  | 'cadence'
  | 'secondaryDominant'
  | 'modal';

/** A ranked next-chord candidate. Degree-based so it transposes with the key. */
export interface ProgressionSuggestion {
  /** Semitones of the chord root above the tonic. */
  rootOffset: number;
  /** Chord-quality suffix (e.g. '', 'm', '7', 'maj7'). */
  suffix: string;
  /** Harmonic function → accent colour. */
  function: ChordFunction;
  /** Roman-numeral degree label (e.g. 'IV', 'V7/ii', '♭VII'). */
  degreeLabel: string;
  /** Chord name spelled for the key (e.g. 'G', 'Am', 'E7'). */
  displayName: string;
  /** Pro-only colour (borrowed / secondary dominant). */
  isPro: boolean;
  reason: SuggestionReason;
  /** 0..1 "how good does this sound next" estimate (deterministic). */
  score: number;
}

export interface SuggestOptions {
  /** Include Pro colours (secondary dominants / modal interchange). */
  allowPro: boolean;
  /** Cap on returned candidates (default 4). */
  maxResults?: number;
}

/**
 * Degrees to open a blank progression with, best first. Limited to I / IV / vi:
 * the three openers that leave every standard progression reachable. V is a poor
 * first chord (it wants to resolve before anything has been established).
 */
const START_DEGREES: { degree: number; score: number }[] = [
  { degree: 0, score: 1.0 }, // I
  { degree: 5, score: 0.7 }, // vi
  { degree: 3, score: 0.66 }, // IV
];

/**
 * Function-to-function pull weights (general harmony). Row = current function, value =
 * how strongly it wants to move to that next function. Dominant→Tonic is the strongest.
 */
const FUNCTION_PULL: Record<ChordFunction, Partial<Record<ChordFunction, number>>> = {
  tonic: { subdominant: 0.72, dominant: 0.64, tonic: 0.42 },
  subdominant: { dominant: 0.82, tonic: 0.52, subdominant: 0.34 },
  dominant: { tonic: 0.9, subdominant: 0.4, dominant: 0.22 },
};

/**
 * Standard "定番" progressions as 0-based degree sequences (I=0 … vii=6). Matching the
 * tail of the current progression to a slice of a template lets us suggest the next
 * chord of a familiar shape with a high score (longer match = more confident). `pop`
 * is a small popularity nudge so that when two templates continue the same tail, the
 * more ubiquitous one (e.g. the pop "axis" I–V–vi–IV) is offered first.
 */
const TEMPLATES: readonly { seq: readonly number[]; pop: number }[] = [
  { seq: [0, 4, 5, 3], pop: 0.1 }, // I–V–vi–IV (axis)
  { seq: [1, 4, 0], pop: 0.09 }, // ii–V–I
  { seq: [5, 3, 0, 4], pop: 0.08 }, // vi–IV–I–V
  { seq: [3, 4, 2, 5], pop: 0.08 }, // IV–V–iii–vi (royal road 4536)
  { seq: [0, 5, 3, 4], pop: 0.06 }, // I–vi–IV–V (50s)
  { seq: [0, 3, 4, 0], pop: 0.05 }, // I–IV–V–I
  { seq: [0, 4, 5, 2, 3, 0, 3, 4], pop: 0.02 }, // canon (Pachelbel)
];

/** Degree sequence (0..6, or -1 for a non-diatonic chord) of the progression so far. */
function degreeSequence(rootOffsets: number[]): number[] {
  return rootOffsets.map((o) => degreeIndexFromRootOffset(o));
}

/**
 * Best template continuation: for every template, find the LONGEST suffix of the
 * current degree sequence that appears as a contiguous slice ending before a further
 * degree, and propose that next degree. Returns degree → score (longer match ⇒ higher).
 */
function templateContinuations(seq: number[]): Map<number, number> {
  const out = new Map<number, number>();
  const lastValid = (() => {
    // Only match from the last contiguous run of diatonic degrees (ignore a leading
    // non-diatonic chord); a -1 in the tail means no template match.
    let start = seq.length;
    while (start > 0 && seq[start - 1] >= 0) start--;
    return seq.slice(start);
  })();
  if (lastValid.length === 0) return out;

  for (const { seq: tpl, pop } of TEMPLATES) {
    for (let i = 0; i + 1 < tpl.length; i++) {
      // Longest k such that tpl[i-k+1..i] === tail of lastValid, then next = tpl[i+1].
      let k = 0;
      while (
        k < lastValid.length &&
        i - k >= 0 &&
        tpl[i - k] === lastValid[lastValid.length - 1 - k]
      ) {
        k++;
      }
      if (k === 0) continue;
      const nextDegree = tpl[i + 1];
      // Confidence grows with match length; the popularity nudge breaks ties between
      // templates that continue the same tail. Capped below 1 so cadence (0.97) can top it.
      const score = Math.min(0.96, 0.5 + 0.13 * k + pop);
      out.set(nextDegree, Math.max(out.get(nextDegree) ?? 0, score));
    }
  }
  return out;
}

/** Add or upgrade a candidate in the map (keep the highest score / its reason). */
function upsert(
  map: Map<string, ProgressionSuggestion>,
  cand: ProgressionSuggestion,
): void {
  const key = `${cand.rootOffset}:${cand.suffix}`;
  const prev = map.get(key);
  if (!prev || cand.score > prev.score) map.set(key, cand);
}

/**
 * Ranked next-chord candidates for the current progression in `key`. Free tier returns
 * basic diatonic chords guided by function pull + standard progressions + cadence; Pro
 * additionally mixes in borrowed and secondary-dominant colours. Deterministic.
 */
export function suggestNext(
  progression: { rootOffset: number; function: ChordFunction }[],
  key: MajorKey,
  options: SuggestOptions,
): ProgressionSuggestion[] {
  const maxResults = options.maxResults ?? 4;
  const triads = diatonicTriads(key); // index 0..6, free basic chords
  const candidates = new Map<string, ProgressionSuggestion>();

  // Empty progression → offer strong openers.
  if (progression.length === 0) {
    for (const { degree, score } of START_DEGREES) {
      const t = triads[degree];
      upsert(candidates, {
        rootOffset: t.rootOffset,
        suffix: t.suffix,
        function: t.function,
        degreeLabel: t.degreeLabel,
        displayName: t.displayName,
        isPro: false,
        reason: 'start',
        score,
      });
    }
    return rank(candidates, maxResults);
  }

  const last = progression[progression.length - 1];
  const lastIdx = degreeIndexFromRootOffset(last.rootOffset);
  const lastFn: ChordFunction = lastIdx >= 0 ? triads[lastIdx].function : last.function;
  const nearPhraseEnd = progression.length % 4 === 3; // 4th chord resolves a bar-phrase

  // 1) Functional pull — every diatonic triad scored by how well its function follows.
  const pull = FUNCTION_PULL[lastFn] ?? {};
  for (const t of triads) {
    const w = pull[t.function];
    if (w === undefined) continue;
    upsert(candidates, {
      rootOffset: t.rootOffset,
      suffix: t.suffix,
      function: t.function,
      degreeLabel: t.degreeLabel,
      displayName: t.displayName,
      isPro: false,
      reason: 'functional',
      score: w,
    });
  }

  // 2) Standard-progression continuation (higher confidence than raw function pull).
  const seq = degreeSequence(progression.map((c) => c.rootOffset));
  for (const [degree, score] of templateContinuations(seq)) {
    const t = triads[degree];
    upsert(candidates, {
      rootOffset: t.rootOffset,
      suffix: t.suffix,
      function: t.function,
      degreeLabel: t.degreeLabel,
      displayName: t.displayName,
      isPro: false,
      reason: 'template',
      score,
    });
  }

  // 3) Cadence pull near a phrase end: a dominant wants to resolve to I strongly.
  if (nearPhraseEnd && lastFn === 'dominant') {
    const tonic = triads[0];
    upsert(candidates, {
      rootOffset: tonic.rootOffset,
      suffix: tonic.suffix,
      function: tonic.function,
      degreeLabel: tonic.degreeLabel,
      displayName: tonic.displayName,
      isPro: false,
      reason: 'cadence',
      score: 0.97,
    });
  }

  // 4) Pro colours: secondary dominants + modal interchange (borrowed).
  if (options.allowPro) {
    for (const c of secondaryDominants(key)) {
      upsert(candidates, {
        rootOffset: c.rootOffset,
        suffix: c.suffix,
        function: c.function,
        degreeLabel: c.degreeLabel,
        displayName: c.displayName,
        isPro: true,
        reason: 'secondaryDominant',
        score: 0.5,
      });
    }
    for (const c of modalInterchange(key)) {
      upsert(candidates, {
        rootOffset: c.rootOffset,
        suffix: c.suffix,
        function: c.function,
        degreeLabel: c.degreeLabel,
        displayName: c.displayName,
        isPro: true,
        reason: 'modal',
        score: 0.48,
      });
    }
  }

  return rank(candidates, maxResults);
}

/**
 * Turn a suggestion into an id-less {@link ChordEvent} ready for `session.addChord`.
 * Pure — the feature layer supplies the desired `durationBeats` (default a full bar).
 */
export function suggestionToChordEvent(
  s: ProgressionSuggestion,
  durationBeats: ChordDuration = 4,
): Omit<ChordEvent, 'id'> {
  return {
    chordId: `sugg-${s.rootOffset}-${s.suffix || 'maj'}`,
    displayName: s.displayName,
    degreeLabel: s.degreeLabel,
    function: s.function,
    durationBeats,
    isPro: s.isPro,
    rootOffset: s.rootOffset,
    suffix: s.suffix,
  };
}

/** Deterministic ranking: score desc, then rootOffset asc, then suffix asc. */
function rank(map: Map<string, ProgressionSuggestion>, maxResults: number): ProgressionSuggestion[] {
  return [...map.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.rootOffset - b.rootOffset ||
        (a.suffix < b.suffix ? -1 : a.suffix > b.suffix ? 1 : 0),
    )
    .slice(0, Math.max(0, maxResults));
}
