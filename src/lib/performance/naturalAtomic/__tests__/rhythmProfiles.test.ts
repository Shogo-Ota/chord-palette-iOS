import {
  naturalRhythmForChord,
  naturalRhythmStrategyFor,
} from '@/lib/performance/naturalAtomic/rhythmProfiles';

function onsets(
  type: 'natural.type1' | 'natural.type2' | 'natural.type3' | 'natural.type4' | 'natural.type5',
  chordIndex = 0,
) {
  return naturalRhythmForChord(naturalRhythmStrategyFor(type), chordIndex, 4).map(
    (attack) => attack.onsetBeat,
  );
}

describe('Natural explicit rhythm strategies', () => {
  it('makes Type1 the five-attack beautiful phrase on every chord', () => {
    expect(onsets('natural.type1')).toEqual([0, 1, 1.5, 2.5, 3]);
    expect(
      naturalRhythmForChord(naturalRhythmStrategyFor('natural.type1'), 0, 4).map(
        (attack) => attack.durationBeat,
      ),
    ).toEqual([0.78, 0.28, 0.78, 0.28, 0.78]);
  });

  it('promotes Candidate 01 as the six-group Type2 comping gesture', () => {
    for (let bar = 0; bar < 4; bar += 1) {
      expect(onsets('natural.type2', bar)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
    }
    expect(naturalRhythmStrategyFor('natural.type2')).toMatchObject({
      sustainBass: false,
      pedalPolicy: 'CANDIDATE',
    });
  });

  it('promotes Candidate 02 as a four-bar syncopated Type3 phrase', () => {
    expect(onsets('natural.type3', 0)).toEqual([0, 0.75, 0.98, 1.5, 2.25, 2.5, 3, 3.25, 3.75]);
    expect(onsets('natural.type3', 1)).toEqual([0, 1, 1.5, 2, 2.25, 2.5, 3, 3.25, 3.75]);
    expect(onsets('natural.type3', 3)).toEqual([0, 1, 1.25, 1.5, 1.75, 2.5, 3, 3.5]);
  });

  it('keeps Candidate 03 dense and Candidate 04 strictly eighth-note broken', () => {
    expect(onsets('natural.type4', 0)).toEqual([
      0, 0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.25, 3.5, 3.75,
    ]);
    expect(onsets('natural.type4', 3)).toEqual([0, 0.5, 1, 1.5, 1.75, 2, 2.5, 3, 3.5, 3.75]);
    expect(onsets('natural.type5', 0)).toEqual([0, 0.5, 1, 1.5, 2.5, 3, 3.5]);
  });

  it('uses uncompressed prefixes for one- and two-beat chords', () => {
    const type2 = naturalRhythmStrategyFor('natural.type2');
    const type3 = naturalRhythmStrategyFor('natural.type3');
    const type5 = naturalRhythmStrategyFor('natural.type5');

    expect(naturalRhythmForChord(type2, 0, 1).map((attack) => attack.onsetBeat)).toEqual([0]);
    expect(naturalRhythmForChord(type2, 0, 2).map((attack) => attack.onsetBeat)).toEqual([
      0, 1, 1.5,
    ]);
    expect(naturalRhythmForChord(type3, 0, 2).map((attack) => attack.onsetBeat)).toEqual([
      0, 0.75, 0.98, 1.5,
    ]);
    expect(naturalRhythmForChord(type5, 0, 1).map((attack) => attack.onsetBeat)).toEqual([0, 0.5]);
  });

  it.each(['natural.type2', 'natural.type3', 'natural.type4', 'natural.type5'] as const)(
    '%s clips 0.25/0.5/1/2-beat chords without compressing its phrase',
    (variant) => {
      const strategy = naturalRhythmStrategyFor(variant);
      for (const duration of [0.25, 0.5, 1, 2, 4]) {
        const attacks = naturalRhythmForChord(strategy, 0, duration);
        expect(attacks.length).toBeGreaterThan(0);
        expect(attacks[0]!.onsetBeat).toBe(0);
        expect(attacks.every((attack) => attack.onsetBeat < duration)).toBe(true);
        expect(attacks.every((attack) => attack.onsetBeat + attack.durationBeat <= duration)).toBe(
          true,
        );
      }
    },
  );

  it('falls back to the simple Type1 strategy for stale ids', () => {
    expect(naturalRhythmStrategyFor('legacy').id).toBe('natural.type1');
  });
});
