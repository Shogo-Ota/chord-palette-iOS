import {
  minorAvailableVariations,
  minorExtendedVariations,
  minorStrongVariations,
  minorVariationChord,
} from '@/data/minorVariations';
import { MAJOR_KEYS } from '@/data/music';
import { MINOR_SCALE_OFFSETS } from '@/data/minorMode';
import { intervalsForChord } from '@/lib/theory/definitions';

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

describe('natural-minor variation provider', () => {
  it('keeps every core and extended note inside natural minor in all 12 keys', () => {
    const allowed = new Set(MINOR_SCALE_OFFSETS);

    for (const key of MAJOR_KEYS) {
      for (let degree = 0; degree < 7; degree += 1) {
        const ids = [...minorAvailableVariations(degree), ...minorExtendedVariations(degree)];
        for (const id of ids) {
          const chord = minorVariationChord(key, degree, id);
          const pitches = intervalsForChord(chord.suffix, chord.definitionId).map((interval) =>
            wrap(chord.rootOffset + interval),
          );
          expect({
            key,
            degree,
            chord: chord.displayName,
            outside: pitches.filter((pitch) => !allowed.has(pitch)),
          }).toEqual({ key, degree, chord: chord.displayName, outside: [] });
        }
      }
    }
  });

  it('resolves every offered form through the production chord catalog', () => {
    for (const key of MAJOR_KEYS) {
      for (let degree = 0; degree < 7; degree += 1) {
        const ids = [
          ...minorAvailableVariations(degree),
          ...minorExtendedVariations(degree),
          ...minorStrongVariations(degree),
        ];
        for (const id of ids) {
          const chord = minorVariationChord(key, degree, id);
          expect({ chord: chord.displayName, definitionId: chord.definitionId }).toEqual({
            chord: chord.displayName,
            definitionId: expect.any(String),
          });
        }
      }
    }
  });

  it('keeps avoid-note colours out of the two safe rows', () => {
    const avoidByDegree = [['m7b13'], ['m7b5_b9'], [], [], ['m7b9', 'm7b13'], [], []];

    for (let degree = 0; degree < 7; degree += 1) {
      const safe = new Set([
        ...minorAvailableVariations(degree),
        ...minorExtendedVariations(degree),
      ]);
      expect(avoidByDegree[degree].filter((id) => safe.has(id as never))).toEqual([]);
      for (const id of avoidByDegree[degree]) {
        expect(minorStrongVariations(degree)).toContain(id);
      }
    }
  });

  /**
   * ♭VI's #11 is diatonic in natural minor, so it was previously an in-key colour.
   * It sits under 強い色づけ now for the same reason IV's does in major: whether a
   * tension belongs to the scale says nothing about how strongly it colours.
   */
  it('puts every deliberate character under 強い色づけ, in-key or not', () => {
    expect(minorStrongVariations(0)).toEqual(['m7b13']);
    expect(minorStrongVariations(1)).toEqual(['m7b5_b9']);
    expect(minorStrongVariations(4)).toEqual(['m7b9', 'm7b13']);
    expect(minorStrongVariations(5)).toEqual(['maj9sharp11', 'maj13sharp11']);
    for (const degree of [2, 3, 6]) {
      expect(minorStrongVariations(degree)).toEqual([]);
    }
  });

  it('captions every form as the quality it produces, not the shared id', () => {
    expect(minorVariationChord('C', 0, '9')).toMatchObject({
      displayName: 'Cm9',
      subLabel: 'm9',
    });
    expect(minorVariationChord('C', 2, '9')).toMatchObject({
      displayName: 'E♭maj9',
      subLabel: 'maj9',
    });
    expect(minorVariationChord('C', 6, '9')).toMatchObject({
      displayName: 'B♭9',
      subLabel: '9',
    });
    expect(minorVariationChord('C', 3, '6')).toMatchObject({
      displayName: 'Fm6',
      subLabel: 'm6',
    });
  });
});
