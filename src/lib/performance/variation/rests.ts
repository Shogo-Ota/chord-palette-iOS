/**
 * `rests` rule (design §3-2): probabilistically drop weak-beat chord strikes to open
 * up space, so the comp breathes instead of machine-gunning every grid step. Strong
 * beats and every bar head are PROTECTED (never dropped) and each phrase has a hard
 * cap, so the groove's identity (its down-beat skeleton) is always preserved.
 */

import type { Strike, StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import type { StylePreset } from '../styles/types';
import type { CappedRule, VariationContext } from './types';
import { isBeatHead, phraseOf } from './helpers';

export function applyRests(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  rule: CappedRule,
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || rule.probability <= 0 || rule.maxPerPhrase <= 0) return;

  const droppedPerPhrase = new Map<number, number>();
  const kept: Strike[] = [];
  for (const s of chord) {
    // Protect strong beats + bar heads (isBeatHead covers step 0 and every integer beat).
    if (isBeatHead(style, s.step)) {
      kept.push(s);
      continue;
    }
    const phrase = phraseOf(s.bar, ctx.phraseLength);
    const used = droppedPerPhrase.get(phrase) ?? 0;
    const fire = used < rule.maxPerPhrase &&
      streamFor(seed, 'var', 'rests', s.bar, s.step).bool(rule.probability);
    if (fire) {
      droppedPerPhrase.set(phrase, used + 1);
      continue; // drop this strike
    }
    kept.push(s);
  }
  strikes.chord = kept;
}
