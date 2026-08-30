import {
  minorAlteredVariations,
  minorAvailableVariations,
  minorExtendedVariations,
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
          ...minorAlteredVariations(degree),
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

  it('keeps avoid-note colours out of core and extended tiers', () => {
    const avoidByDegree = [['m7b13'], ['m7b5_b9'], [], [], ['m7b9', 'm7b13'], [], []];

    for (let degree = 0; degree < 7; degree += 1) {
      const safe = new Set([
        ...minorAvailableVariations(degree),
        ...minorExtendedVariations(degree),
      ]);
      expect(avoidByDegree[degree].filter((id) => safe.has(id as never))).toEqual([]);
      expect(minorAlteredVariations(degree)).toEqual(avoidByDegree[degree]);
    }
  });
});
