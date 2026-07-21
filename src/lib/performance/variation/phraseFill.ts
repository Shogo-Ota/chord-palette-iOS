/**
 * `phraseFill` rule (design §3-2): a phrase resolves at its end. Two gentle moves:
 *  1. `sustainFinal` — the very last chord of the progression is held (long ring),
 *     giving a natural "landing" instead of a clipped final stab.
 *  2. `extraStab` — on the last bar of a phrase, optionally add one late chord stab as
 *     a small pickup into the next phrase (capped by probability, silent-step only).
 * Bar heads are never touched. Deterministic (seed-derived).
 */

import type { Strike, StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import { stepBeat, type StylePreset } from '../styles/types';
import type { VariationContext, VariationProfile } from './types';
import { hasStrikeAt, isBeatHead, phraseIndexOf } from './helpers';

export function applyPhraseFill(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  profile: VariationProfile['phraseFill'],
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || chord.length === 0) return;

  if (profile.sustainFinal) {
    // Hold the last-sounding chord strike so the progression rings out at the end.
    let last = chord[0];
    for (const s of chord) if (s.gridBeat > last.gridBeat) last = s;
    last.sustain = true;
  }

  if (profile.extraStabProbability > 0) {
    const lastPhraseBarIndex = ctx.phraseLength - 1;
    for (let bar = 0; bar < ctx.bars; bar++) {
      const isPhraseEnd =
        phraseIndexOf(bar, ctx.phraseLength) === lastPhraseBarIndex || bar === ctx.bars - 1;
      if (!isPhraseEnd) continue;
      const inBar = chord.filter((s) => s.bar === bar);
      if (inBar.length === 0) continue;
      const target = lastOffBeatStep(style);
      if (target < 0 || hasStrikeAt(chord, bar, target)) continue;
      if (!streamFor(seed, 'var', 'phraseFill', bar).bool(profile.extraStabProbability)) continue;

      const source = inBar[inBar.length - 1];
      const stab: Strike = {
        bar,
        step: target,
        gridBeat: bar * style.beatsPerBar + stepBeat(style, target),
        accent: 0.6,
        ghost: false,
        pitches: [...source.pitches],
      };
      chord.push(stab);
    }
  }

  strikes.chord = chord;
}

function lastOffBeatStep(style: StylePreset): number {
  for (let step = style.stepsPerBar - 1; step >= 0; step--) {
    if (!isBeatHead(style, step)) return step;
  }
  return -1;
}
