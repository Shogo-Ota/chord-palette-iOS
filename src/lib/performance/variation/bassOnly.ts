/**
 * `bassOnly` rule (design §3-2): occasionally a whole bar drops its chord comp and
 * leaves only the bass walking underneath — a classic arranging "breather". It is
 * rare (low probability, capped per phrase) and NEVER applied to the first or last
 * bar (those anchor the intro/resolution), so the bass always keeps that bar's head
 * and the progression's shape is preserved.
 */

import type { StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import type { StylePreset } from '../styles/types';
import type { CappedRule, VariationContext } from './types';
import { phraseOf } from './helpers';

export function applyBassOnly(
  strikes: StrikesByTrack,
  _style: StylePreset,
  ctx: VariationContext,
  rule: CappedRule,
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || rule.probability <= 0 || rule.maxPerPhrase <= 0 || ctx.bars < 3) return;

  const usedPerPhrase = new Map<number, number>();
  const strippedBars = new Set<number>();

  for (let bar = 1; bar < ctx.bars - 1; bar++) {
    const phrase = phraseOf(bar, ctx.phraseLength);
    if ((usedPerPhrase.get(phrase) ?? 0) >= rule.maxPerPhrase) continue;
    if (!streamFor(seed, 'var', 'bassOnly', bar).bool(rule.probability)) continue;
    strippedBars.add(bar);
    usedPerPhrase.set(phrase, (usedPerPhrase.get(phrase) ?? 0) + 1);
  }

  if (strippedBars.size === 0) return;
  strikes.chord = chord.filter((s) => !strippedBars.has(s.bar));
  if (strikes.top) strikes.top = strikes.top.filter((s) => !strippedBars.has(s.bar));
}
