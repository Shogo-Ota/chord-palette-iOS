/**
 * `twoFourBar` rule (design §3-2): a 4-bar pop phrase rarely repeats its bars
 * identically — the 2nd and 4th bars usually get a small twist. This rule adds ONE
 * extra chord stab on a late syncopation (an otherwise-silent off-beat) of those bars
 * with a capped probability, borrowing the bar's own chord voicing. It never touches
 * the bar head and is capped per phrase, so the phrase feature is enriched, not lost.
 */

import type { Strike, StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import { stepBeat, type StylePreset } from '../styles/types';
import type { CappedRule, VariationContext } from './types';
import { hasStrikeAt, isBeatHead, phraseIndexOf, phraseOf } from './helpers';

/** Bars (within a phrase) that may vary: the 2nd (index 1) and 4th (index 3). */
const VARY_BAR_INDICES = new Set([1, 3]);

export function applyTwoFourBar(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  rule: CappedRule,
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || rule.probability <= 0 || rule.maxPerPhrase <= 0) return;

  const addedPerPhrase = new Map<number, number>();

  for (let bar = 0; bar < ctx.bars; bar++) {
    if (!VARY_BAR_INDICES.has(phraseIndexOf(bar, ctx.phraseLength))) continue;
    const phrase = phraseOf(bar, ctx.phraseLength);
    if ((addedPerPhrase.get(phrase) ?? 0) >= rule.maxPerPhrase) continue;

    const inBar = chord.filter((s) => s.bar === bar);
    if (inBar.length === 0) continue; // nothing to borrow a voicing from
    if (!streamFor(seed, 'var', 'twoFour', bar).bool(rule.probability)) continue;

    // Target the last off-beat step of the bar (a natural late-bar push), if silent.
    const target = lastOffBeatStep(style);
    if (target < 0 || hasStrikeAt(chord, bar, target)) continue;

    const source = inBar[inBar.length - 1];
    const gridBeat = bar * style.beatsPerBar + stepBeat(style, target);
    const stab: Strike = {
      bar,
      step: target,
      gridBeat,
      accent: 0.62,
      ghost: false,
      pitches: [...source.pitches],
    };
    chord.push(stab);
    addedPerPhrase.set(phrase, (addedPerPhrase.get(phrase) ?? 0) + 1);
  }

  strikes.chord = chord;
}

/** The last off-beat (non-integer-beat) step of a bar — the late-bar push slot. */
function lastOffBeatStep(style: StylePreset): number {
  for (let step = style.stepsPerBar - 1; step >= 0; step--) {
    if (!isBeatHead(style, step)) return step;
  }
  return -1;
}
