import type { NaturalRhythmAttackSpec } from './rhythmProfiles';

const DROPOUT_ONSETS = [0, 1, 1.75, 2.5, 3.5] as const;

function isDropoutBar(attacks: readonly NaturalRhythmAttackSpec[]): boolean {
  if (attacks.length !== DROPOUT_ONSETS.length) return false;
  return attacks.every(
    (attack, index) => Math.abs(attack.onsetBeat - DROPOUT_ONSETS[index]!) <= 1e-9,
  );
}

/**
 * A split terminal bar is already lighter than a full bar. When it follows the
 * measured bar-7 dropout, restore only the omitted low pair so two thinning devices
 * do not stack. Normal Dance dropouts remain untouched.
 */
export function splitTerminalBarSupportAttack(
  sourceBar: readonly NaturalRhythmAttackSpec[],
  nextBarIsSplitHalfPair: boolean,
): NaturalRhythmAttackSpec | null {
  if (!nextBarIsSplitHalfPair || !isDropoutBar(sourceBar)) return null;

  return {
    onsetBeat: 1.5,
    durationBeat: 1,
    velocity: 80,
    selection: { kind: 'VOICE_ROLES', roles: ['BASS', 'RH_BOTTOM'] },
    velocityShape: { left: 80, rightByAscendingRank: [80] },
  };
}
