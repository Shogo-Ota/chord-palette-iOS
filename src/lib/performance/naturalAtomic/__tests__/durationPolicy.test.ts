import { fitNaturalGate, mapNaturalSourceOnset, naturalDurationPolicy } from '../durationPolicy';

const SOURCE_ATTACKS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] as const;

function mappedAttacks(chordDurationBeats: number): number[] {
  const policy = naturalDurationPolicy(chordDurationBeats, 4);
  return SOURCE_ATTACKS.map((beat) => mapNaturalSourceOnset(beat, policy)).filter(
    (beat): beat is number => beat != null,
  );
}

describe('Natural duration policy', () => {
  it('preserves a full Teacher bar exactly', () => {
    expect(mappedAttacks(4)).toEqual(SOURCE_ATTACKS);
  });

  it('uses an uncompressed two-beat prefix for a half-bar chord', () => {
    expect(mappedAttacks(2)).toEqual([0, 0.5, 1, 1.5]);
  });

  it('uses an uncompressed one-beat prefix for a quarter-bar chord', () => {
    expect(mappedAttacks(1)).toEqual([0, 0.5]);
  });

  it('clips a written gate at the chord boundary', () => {
    const policy = naturalDurationPolicy(1, 4);
    expect(fitNaturalGate(0.75, 0.5, policy)).toBe(0.5);
  });
});
