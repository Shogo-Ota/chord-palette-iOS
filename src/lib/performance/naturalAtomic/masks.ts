import { applyVoicingMask, maskContainsColor } from '../chordComping';
import { kindOfDegree } from '../humanTemplate/degreeRoles';
import type { AtomicGrooveAttack, FullVoicing, NaturalVoicingMask } from './types';

export { applyVoicingMask, maskContainsColor };

/**
 * Natural Type1 PoC policy. It reads only correlated group-level performance
 * properties—onset, gate and velocity—not teacher pitch, degree sequence or note count.
 */
export function type1MaskSequence(
  attacks: readonly Omit<AtomicGrooveAttack, 'mask'>[],
  voicings: readonly FullVoicing[],
): NaturalVoicingMask[] {
  const firstAttackByChord = new Set<number>();
  const velocityByChord = new Map<number, number[]>();
  for (const attack of attacks) {
    const values = velocityByChord.get(attack.chordIndex) ?? [];
    values.push(attack.velocity);
    velocityByChord.set(attack.chordIndex, values);
  }

  return attacks.map((attack) => {
    const voicing = voicings.find((candidate) => candidate.chordIndex === attack.chordIndex);
    if (!voicing) return 'FULL';
    if (!firstAttackByChord.has(attack.chordIndex)) {
      firstAttackByChord.add(attack.chordIndex);
      return 'FULL';
    }
    const values = velocityByChord.get(attack.chordIndex) ?? [attack.velocity];
    const center = values.reduce((sum, value) => sum + value, 0) / values.length;
    const beatFraction = ((attack.onsetBeat % 1) + 1) % 1;
    const offbeat = Math.abs(beatFraction) > 1 / 16;
    const shortGesture = attack.durationBeat <= 0.375;
    const weakGesture = attack.velocity < center - 4;

    if (shortGesture && (offbeat || weakGesture)) return 'ROOT_ONLY';
    if (offbeat) {
      return voicing.notes.some((note) => kindOfDegree(note.degree) === 'color')
        ? 'SHELL'
        : 'TRIAD';
    }
    return 'TRIAD';
  });
}
