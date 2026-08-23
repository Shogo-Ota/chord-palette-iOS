import { velocityForNaturalAttackNote } from '@/lib/performance/naturalAtomic/attackVelocityPolicy';
import type { FullVoicingNote } from '@/lib/performance/naturalAtomic/types';

function note(pitch: number, handRole: 'LEFT' | 'RIGHT'): FullVoicingNote {
  return {
    pitch,
    pc: pitch % 12,
    interval: 0,
    degree: 'root',
    handRole,
    isBass: handRole === 'LEFT',
    isDuplicate: false,
  };
}

describe('Natural attack velocity policy', () => {
  const selected = [note(43, 'LEFT'), note(55, 'RIGHT'), note(62, 'RIGHT'), note(67, 'RIGHT')];

  it('leaves every existing attack unchanged when no shape is declared', () => {
    expect(
      selected.map((candidate) => velocityForNaturalAttackNote(candidate, selected, 86)),
    ).toEqual([86, 86, 86, 86]);
  });

  it('applies an absolute left-hand value and low-to-high right-hand envelope', () => {
    const shape = { left: 88, rightByAscendingRank: [77, 85, 97] } as const;
    expect(
      selected.map((candidate) => velocityForNaturalAttackNote(candidate, selected, 86, shape)),
    ).toEqual([88, 77, 85, 97]);
  });

  it('resamples the envelope without depending on absolute pitch', () => {
    const fourRight = [...selected, note(71, 'RIGHT')];
    const shape = { rightByAscendingRank: [77, 85, 97] } as const;
    expect(
      fourRight
        .filter((candidate) => candidate.handRole === 'RIGHT')
        .map((candidate) => velocityForNaturalAttackNote(candidate, fourRight, 86, shape)),
    ).toEqual([77, 82, 89, 97]);
  });
});
