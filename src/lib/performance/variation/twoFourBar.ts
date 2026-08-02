/**
 * Phrase-position rule (design §3-2, extended per implementation_v1.01 Phase 8).
 * A 4-bar pop phrase is not four copies of one bar:
 *
 *   bar 1 — the statement, left alone;
 *   bars 2–3 — a SMALL change: one extra chord stab on a late syncopation (an
 *              otherwise-silent off-beat), borrowing the bar's own voicing;
 *   bar 4 — a CONNECTING change: the bar's final off-beat chord strike is
 *           dropped so the phrase takes a breath and leans into the next one
 *           (「最終拍の音を減らす／次へつなぐ」).
 *
 * Everything is decided by phrase POSITION (never a random fill), capped per
 * phrase, seed-deterministic, and the bar head is never touched. The
 * progression's very last bar is left to `phraseFill` (its ending sustain).
 */

import type { Strike, StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import { stepBeat, type StylePreset } from '../styles/types';
import type { CappedRule, VariationContext } from './types';
import { hasStrikeAt, isBeatHead, phraseIndexOf, phraseOf } from './helpers';

export function applyTwoFourBar(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  rule: CappedRule,
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || rule.probability <= 0 || rule.maxPerPhrase <= 0) return;

  const stabsPerPhrase = new Map<number, number>();
  const lastPhraseIndex = ctx.phraseLength - 1;

  for (let bar = 0; bar < ctx.bars; bar++) {
    const position = phraseIndexOf(bar, ctx.phraseLength);
    const phrase = phraseOf(bar, ctx.phraseLength);

    if (position >= 1 && position < lastPhraseIndex) {
      // Small change (bars 2–3): one added stab, capped per phrase.
      if ((stabsPerPhrase.get(phrase) ?? 0) >= rule.maxPerPhrase) continue;
      const inBar = chord.filter((s) => s.bar === bar);
      if (inBar.length === 0) continue; // nothing to borrow a voicing from
      if (!streamFor(seed, 'var', 'twoFour', bar).bool(rule.probability)) continue;

      // Target the last off-beat step of the bar (a natural late-bar push), if silent.
      const target = lastOffBeatStep(style);
      if (target < 0 || hasStrikeAt(chord, bar, target)) continue;

      const source = inBar[inBar.length - 1];
      const stab: Strike = {
        bar,
        step: target,
        gridBeat: bar * style.beatsPerBar + stepBeat(style, target),
        accent: 0.62,
        ghost: false,
        pitches: [...source.pitches],
      };
      chord.push(stab);
      stabsPerPhrase.set(phrase, (stabsPerPhrase.get(phrase) ?? 0) + 1);
    } else if (position === lastPhraseIndex && bar !== ctx.bars - 1) {
      // Connecting change (bar 4, but never the progression's final bar): thin
      // the tail — drop the bar's last chord strike when it sits off the bar
      // head, so the next phrase's downbeat lands into a breath.
      if (!streamFor(seed, 'var', 'fourConnect', bar).bool(rule.probability)) continue;
      const inBar = chord.filter((s) => s.bar === bar);
      const last = inBar[inBar.length - 1];
      if (!last || last.step === 0) continue; // a lone bar-head stays
      const idx = chord.indexOf(last);
      if (idx >= 0) chord.splice(idx, 1);
    }
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
