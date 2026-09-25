import { advancedLibraryGroups } from '@/features/editor/advancedLibrary';
import { minorPrimaryDominants } from '@/data/minorAdvancedChords';
import { MAJOR_KEYS, keyTonicPc } from '@/data/music';

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

describe('minor advanced harmony provider', () => {
  it('offers the sourced harmonic-minor V7 family', () => {
    const chords = minorPrimaryDominants('C');

    expect(chords.map((chord) => chord.displayName)).toEqual(['G7', 'G7(♭9)', 'G7(♭13)']);
    expect(chords.map((chord) => chord.degreeLabel)).toEqual(['V7', 'V7(♭9)', 'V7(♭13)']);
    expect(chords.every((chord) => chord.category === 'primaryDominant')).toBe(true);
    expect(chords.every((chord) => chord.function === 'dominant')).toBe(true);
    expect(chords.every((chord) => chord.isPro)).toBe(true);
  });

  it('roots every minor primary dominant a perfect fifth above its tonic', () => {
    for (const key of MAJOR_KEYS) {
      for (const chord of minorPrimaryDominants(key)) {
        expect({ key, offset: chord.rootOffset }).toEqual({ key, offset: 7 });
        expect(wrap(keyTonicPc(key) + chord.rootOffset)).toBe(wrap(keyTonicPc(key) + 7));
      }
    }
  });

  it('resolves a production chord definition for every form', () => {
    for (const key of MAJOR_KEYS) {
      for (const chord of minorPrimaryDominants(key)) {
        expect(chord.definitionId).toEqual(expect.any(String));
        expect(chord.definitionId).not.toBe('');
      }
    }
  });

  it('offers only groups that name the chord they lead to', () => {
    expect(advancedLibraryGroups('C', 'major').map((group) => group.id)).toEqual([
      'secondary-dominant',
      'passing-diminished',
      'substitute-chord',
      'chromatic-mediant',
      'augmented-connector',
    ]);
    expect(advancedLibraryGroups('C', 'minor').map((group) => group.id)).toEqual([
      'minor-primary-dominant',
      'substitute-chord',
      'augmented-connector',
    ]);
  });

  /**
   * An augmented triad is symmetric, so listing all twelve roots named the same four
   * pitch-class sets three times each, with no target. The tab offers the technique
   * instead: a handful of connectors, each naming the chord it resolves into.
   */
  it('offers augmented as a connector rather than as a chord list', () => {
    for (const mode of ['major', 'minor'] as const) {
      const augmented = advancedLibraryGroups('C', mode)
        .flatMap((group) => group.chords)
        .filter((chord) => chord.suffix === 'aug');
      expect(augmented.length).toBeLessThanOrEqual(3);
      for (const chord of augmented) {
        expect(chord.subLabel).toMatch(/^→.+/);
      }
    }
  });

  it('does not invent minor secondary dominants or reverse mixture', () => {
    const minor = advancedLibraryGroups('C', 'minor');

    expect(minor.some((group) => group.id.includes('secondary'))).toBe(false);
    expect(minor.some((group) => group.id.includes('modal'))).toBe(false);
    expect(minor.some((group) => group.id.includes('passing'))).toBe(false);
    expect(minor.some((group) => group.id.includes('chromatic'))).toBe(false);
    expect(minor.find((group) => group.id === 'minor-primary-dominant')!.chords).toHaveLength(3);
  });
});
