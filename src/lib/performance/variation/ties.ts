/**
 * `ties` rule (design §3-2): a syncopated (off-beat) chord that is immediately
 * followed by a strong-beat re-attack is tied OVER that beat — the down-beat attack
 * is suppressed and the off-beat note is held across the boundary (the classic pop
 * "push that rings through the beat"). This both extends the note's duration (the
 * next surviving strike is now farther away) and marks it `tie` for the renderer.
 *
 * The bar head (step 0) is never suppressed, so every bar keeps its down-beat anchor.
 * Capped per phrase and seed-derived (deterministic).
 */

import type { Strike, StrikesByTrack } from '../strike';
import { streamFor } from '../rng';
import type { StylePreset } from '../styles/types';
import type { CappedRule, VariationContext } from './types';
import { isBeatHead, phraseOf } from './helpers';

/** Max beats between the syncopation and the beat it ties over (a real "push"). */
const MAX_TIE_SPAN_BEATS = 1 + 1e-9;

export function applyTies(
  strikes: StrikesByTrack,
  style: StylePreset,
  ctx: VariationContext,
  rule: CappedRule,
  seed: number,
): void {
  const chord = strikes.chord;
  if (!chord || chord.length < 2 || rule.probability <= 0 || rule.maxPerPhrase <= 0) return;

  const tiedPerPhrase = new Map<number, number>();
  const removed = new Set<number>(); // indices of suppressed down-beat re-attacks

  for (let i = 0; i < chord.length - 1; i++) {
    if (removed.has(i)) continue;
    const cur = chord[i];
    const next = chord[i + 1];
    if (removed.has(i + 1)) continue;

    const curOffBeat = !isBeatHead(style, cur.step);
    const nextStrongReattack = isBeatHead(style, next.step) && next.step !== 0;
    const span = next.gridBeat - cur.gridBeat;
    if (!curOffBeat || !nextStrongReattack || span > MAX_TIE_SPAN_BEATS || span <= 0) continue;

    const phrase = phraseOf(cur.bar, ctx.phraseLength);
    const used = tiedPerPhrase.get(phrase) ?? 0;
    if (used >= rule.maxPerPhrase) continue;
    if (!streamFor(seed, 'var', 'ties', cur.bar, cur.step).bool(rule.probability)) continue;

    cur.tie = true; // hold across the beat; duration extends to the next surviving strike
    removed.add(i + 1); // suppress the strong-beat re-attack that is tied over
    tiedPerPhrase.set(phrase, used + 1);
  }

  strikes.chord = chord.filter((_, i) => !removed.has(i));
}
