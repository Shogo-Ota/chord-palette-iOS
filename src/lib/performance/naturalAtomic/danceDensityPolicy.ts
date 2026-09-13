import type { NaturalRhythmAttackSpec } from './rhythmProfiles';

const DROPOUT_ONSETS = [0, 1, 1.75, 2.5, 3.5] as const;

function isDropoutBar(attacks: readonly NaturalRhythmAttackSpec[]): boolean {
  if (attacks.length !== DROPOUT_ONSETS.length) return false;
  return attacks.every(
    (attack, index) => Math.abs(attack.onsetBeat - DROPOUT_ONSETS[index]!) <= 1e-9,
  );
}

/** Why a measured dropout bar may get its omitted low pair back. */
export interface DanceDropoutSupportContext {
  /** The following bar is split into two half-bar chords, so it is already light. */
  nextBarIsSplitHalfPair: boolean;
  /** This is the closing dropout of a progression that already breathed once. */
  closesRepeatedPhrase: boolean;
}

/**
 * The measured bar-7 dropout omits the `BASS + RH_BOTTOM` response on beat 1.5, which
 * is the phrase's breath before the terminal roll/fill. Two contexts restore a single
 * restrained copy of it, because there the omission reads as a weak bar rather than a
 * breath:
 *
 *  - the next bar is a split half pair, so two thinning devices would stack;
 *  - the progression breathes more than once and this is its last dropout, so the
 *    closing phrase would otherwise end thinner than the one before it.
 *
 * A progression with a single dropout keeps the measured breath untouched.
 */
export function danceDropoutSupportAttack(
  sourceBar: readonly NaturalRhythmAttackSpec[],
  context: DanceDropoutSupportContext,
): NaturalRhythmAttackSpec | null {
  if (!isDropoutBar(sourceBar)) return null;
  if (!context.nextBarIsSplitHalfPair && !context.closesRepeatedPhrase) return null;

  return {
    onsetBeat: 1.5,
    durationBeat: 1,
    velocity: 80,
    selection: { kind: 'VOICE_ROLES', roles: ['BASS', 'RH_BOTTOM'] },
    velocityShape: { left: 80, rightByAscendingRank: [80] },
  };
}

/**
 * Whether `bar` carries the progression's last measured dropout while an earlier bar
 * carried one too — the phrase repeated, so its closing breath has already been heard.
 */
export function closesRepeatedDropoutPhrase(input: {
  bar: number;
  lastBar: number;
  attacksForBar: (bar: number) => readonly NaturalRhythmAttackSpec[];
}): boolean {
  if (!isDropoutBar(input.attacksForBar(input.bar))) return false;
  for (let bar = input.bar + 1; bar <= input.lastBar; bar += 1) {
    if (isDropoutBar(input.attacksForBar(bar))) return false;
  }
  for (let bar = input.bar - 1; bar >= 0; bar -= 1) {
    if (isDropoutBar(input.attacksForBar(bar))) return true;
  }
  return false;
}
