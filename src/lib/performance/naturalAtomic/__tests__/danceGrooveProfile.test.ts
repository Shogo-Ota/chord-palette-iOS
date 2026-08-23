import {
  DANCE_GROOVE_PROFILE,
  DANCE_VARIANT_ID,
} from '@/lib/performance/naturalAtomic/danceGrooveProfile';
import { grooveProfileForVariant } from '@/lib/performance/naturalAtomic/grooveProfileRegistry';

function selectionLabel(
  selection: (typeof DANCE_GROOVE_PROFILE.bars)[number][number]['selection'],
): string {
  if (selection.kind === 'MASK') return selection.mask;
  if (selection.kind === 'VOICE_ROLE') return selection.role;
  return selection.roles.join('+');
}

describe('Variation Dance groove profile', () => {
  it('freezes the measured eight-bar syncopation, dropout and terminal roll/fill', () => {
    expect(DANCE_GROOVE_PROFILE.id).toBe('natural.dance1');
    expect(DANCE_GROOVE_PROFILE.sourceCandidateId).toBe(
      'DANCE_MIDI_EE9DD75B_REO_FUNK_INTERSECTION',
    );
    expect(
      DANCE_GROOVE_PROFILE.bars.map((bar) => [...new Set(bar.map((attack) => attack.onsetBeat))]),
    ).toEqual([
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.5, 1.75, 2.5, 3.5],
      [0, 1, 1.75, 2.5, 3.5],
      [0, 0.0438, 1, 1.75, 2.5, 3, 3.5],
    ]);
    expect(DANCE_GROOVE_PROFILE.bars.map((bar) => bar.length)).toEqual([6, 6, 6, 6, 6, 6, 5, 8]);
  });

  it('keeps the measured gate, velocity and Attack Group roles without source pitches', () => {
    expect(
      DANCE_GROOVE_PROFILE.bars[0]!.map((attack) => [
        attack.onsetBeat,
        attack.durationBeat,
        attack.velocity,
        selectionLabel(attack.selection),
      ]),
    ).toEqual([
      [0, 1, 85, 'FULL'],
      [1, 0.5, 84, 'RIGHT_HAND'],
      [1.5, 1, 84, 'BASS+RH_BOTTOM'],
      [1.75, 0.5, 84, 'RIGHT_HAND'],
      [2.5, 1, 84, 'RIGHT_HAND'],
      [3.5, 0.5, 84, 'RIGHT_HAND'],
    ]);
    expect(DANCE_GROOVE_PROFILE.bars[0]!.map((attack) => attack.velocityShape)).toEqual([
      { left: 85, rightByAscendingRank: [87, 92, 102] },
      { left: undefined, rightByAscendingRank: [77, 81, 93] },
      { left: 84, rightByAscendingRank: [84] },
      { left: undefined, rightByAscendingRank: [77, 81, 93] },
      { left: undefined, rightByAscendingRank: [77, 81, 93] },
      { left: undefined, rightByAscendingRank: [77, 81, 93] },
    ]);
  });

  it('preserves the terminal Bass-to-RH roll and split-gate final chord', () => {
    expect(
      DANCE_GROOVE_PROFILE.bars[7]!.map((attack) => [
        attack.onsetBeat,
        attack.durationBeat,
        selectionLabel(attack.selection),
      ]),
    ).toEqual([
      [0, 1, 'BASS'],
      [0.0438, 0.875, 'RIGHT_HAND'],
      [1, 0.5, 'RIGHT_HAND'],
      [1.75, 0.5, 'RIGHT_HAND'],
      [2.5, 0.5, 'RIGHT_HAND'],
      [3, 1, 'BASS'],
      [3, 0.5, 'RIGHT_HAND'],
      [3.5, 0.5, 'RIGHT_HAND'],
    ]);
  });

  it('uses measured note overlap instead of CC64', () => {
    expect(DANCE_GROOVE_PROFILE.pedalByBar).toEqual([[], [], [], [], [], [], [], []]);
  });

  it('is resolved through the generic registry and stores no source harmony', () => {
    expect(grooveProfileForVariant(DANCE_VARIANT_ID)).toBe(DANCE_GROOVE_PROFILE);
    const serialized = JSON.stringify(DANCE_GROOVE_PROFILE);
    for (const forbidden of ['"pitch"', '"pc"', '"key"', '"chord"', '"progression"']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
