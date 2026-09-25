import {
  AUGMENTED_CONNECTOR_DISPLAY_LIMIT,
  augmentedConnectorCards,
  augmentedConnectors,
} from '@/data/augmentedConnectors';
import { pitchClassSetKey } from '@/data/chordPitchClassSet';
import { MAJOR_KEYS, diatonicTriads } from '@/data/music';
import { intervalsForChord } from '@/lib/theory/definitions';
import type { KeyMode, MajorKey } from '@/types';

const MODES: readonly KeyMode[] = ['major', 'minor'];

function cardNames(key: MajorKey, mode: KeyMode): string[] {
  return augmentedConnectorCards(key, mode).map(
    (chord) => `${chord.displayName} ${chord.subLabel}`,
  );
}

describe('augmented connectors in C major', () => {
  /**
   * Ordered by how clearly each one arrives. `Gaug → C` lands on the tonic, `Faug`
   * keeps two of its three notes when it reaches `Dm`, and `Caug → F` shares only C.
   * `Daug → G` generates but does not make the row: it is the one candidate whose
   * F# and A# are both outside the key, so it is the first to give up its slot.
   */
  it('offers the technique, not the chord type', () => {
    expect(cardNames('C', 'major')).toEqual(['Gaug →C', 'Faug →Dm', 'Caug →F']);
  });

  it('generates from every non-diminished degree before display limits', () => {
    const generated = augmentedConnectors('C', 'major');
    expect(generated.map((connector) => connector.chord.displayName)).toEqual([
      'Caug',
      'Daug',
      'Faug',
      'Gaug',
    ]);
    expect(generated.map((connector) => connector.chord.subLabel)).toEqual([
      '→F',
      '→G',
      '→Dm',
      '→C',
    ]);
  });

  /**
   * iii and vi generate nothing because their raised fifth would have to rise to a
   * note the key does not contain: Eaug's C would go to C#, Aaug's F to F#. They are
   * also the symmetric twins of Caug and Faug, so either rule removes them.
   */
  it('never shows two names for one augmented triad', () => {
    const cards = augmentedConnectorCards('C', 'major').map((chord) => chord.displayName);
    expect(cards).not.toContain('Eaug');
    expect(cards).not.toContain('A♭aug');
    expect(cards).not.toContain('Aaug');
  });

  it('never offers vii° as a source or a target', () => {
    for (const connector of augmentedConnectors('C', 'major')) {
      expect(connector.sourceDegreeIndex).not.toBe(6);
      expect(connector.targetDegreeIndex).not.toBe(6);
    }
  });
});

describe('augmented connectors are a technique, not a list', () => {
  it('stays within the display limit in every key and mode', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const cards = augmentedConnectorCards(key, mode);
        expect(cards.length).toBeLessThanOrEqual(AUGMENTED_CONNECTOR_DISPLAY_LIMIT);
        expect(cards.length).toBeGreaterThan(0);
      }
    }
  });

  it('never repeats a pitch-class set within one key', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const keys = augmentedConnectors(key, mode).map((connector) =>
          pitchClassSetKey(connector.chord),
        );
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('names a target on every card', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const chord of augmentedConnectorCards(key, mode)) {
          expect(chord.subLabel).toMatch(/^→.+/);
        }
      }
    }
  });

  it('spells every card as root + major 3rd + augmented 5th', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const chord of augmentedConnectorCards(key, mode)) {
          expect(chord.displayName.endsWith('aug')).toBe(true);
          expect(chord.displayName).not.toMatch(/#5/);
          expect(chord.suffix).toBe('aug');
          expect(chord.definitionId).toBe('aug');
          expect(intervalsForChord(chord.suffix, chord.definitionId)).toEqual([0, 4, 8]);
        }
      }
    }
  });

  it('uses the key\u2019s own spelling for the degree root', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const triads = diatonicTriads(key, mode);
        for (const connector of augmentedConnectors(key, mode)) {
          const root = triads[connector.sourceDegreeIndex]!.displayName.replace(/(m|dim)$/, '');
          expect(connector.chord.displayName).toBe(`${root}aug`);
        }
      }
    }
  });
});

describe('the raised fifth actually resolves', () => {
  it('rises one semitone into a tone of the named target', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const triads = diatonicTriads(key, mode);
        for (const connector of augmentedConnectors(key, mode)) {
          const source = triads[connector.sourceDegreeIndex]!;
          expect(connector.raisedFifthPitchClass).toBe((source.rootOffset + 8) % 12);
          expect(connector.resolutionPitchClass).toBe(
            (connector.raisedFifthPitchClass + 1) % 12,
          );

          const target = triads[connector.targetDegreeIndex]!;
          const targetPitchClasses = intervalsForChord(target.suffix, target.definitionId).map(
            (interval) => (target.rootOffset + interval) % 12,
          );
          expect(targetPitchClasses).toContain(connector.resolutionPitchClass);
        }
      }
    }
  });
});

describe('the progression decides which connector comes first', () => {
  const degreesOf = (degrees: number[]) => ({
    progressionDegrees: degrees,
    selectedDegree: -1,
  });

  it('leads with the connector that bridges two adjacent chords', () => {
    // C | F: Caug sits between them, so it outranks the textbook V+.
    const cards = augmentedConnectorCards('C', 'major', degreesOf([0, 3]));
    expect(cards[0]!.displayName).toBe('Caug');
    expect(cards[0]!.subLabel).toBe('→F');
  });

  it('leads with the connector for the chord the player selected', () => {
    const cards = augmentedConnectorCards('C', 'major', {
      progressionDegrees: [0, 3, 1, 4],
      selectedDegree: 3,
    });
    expect(cards[0]!.displayName).toBe('Faug');
    expect(cards[0]!.subLabel).toBe('→Dm');
  });

  it('falls back to the clearest resolutions when the progression says nothing', () => {
    expect(augmentedConnectorCards('C', 'major', degreesOf([]))).toEqual(
      augmentedConnectorCards('C', 'major'),
    );
  });

  it('never invents a candidate the key cannot express', () => {
    // Context only reorders and trims; the generated set is fixed by the key.
    const generated = new Set(
      augmentedConnectors('C', 'major').map((connector) => connector.chord.displayName),
    );
    for (const degrees of [[0], [4], [0, 1, 2, 3, 4, 5], []]) {
      for (const chord of augmentedConnectorCards('C', 'major', degreesOf(degrees))) {
        expect(generated.has(chord.displayName)).toBe(true);
      }
    }
  });
});

describe('Palette Pro gating', () => {
  it('prices every connector as Palette Pro', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const chord of augmentedConnectorCards(key, mode)) {
          expect(chord.isPro).toBe(true);
          expect(chord.category).toBe('augmentedTriad');
          expect(chord.badgeLabel).toBe('AUG');
        }
      }
    }
  });

  it('gives every card a unique id within a key and mode', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const ids = augmentedConnectorCards(key, mode).map((chord) => chord.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
