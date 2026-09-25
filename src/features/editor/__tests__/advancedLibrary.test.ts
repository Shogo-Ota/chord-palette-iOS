import { MAJOR_KEYS } from '@/data/music';
import { pitchClassSetKey } from '@/data/chordPitchClassSet';
import { advancedLibraryGroups } from '@/features/editor/advancedLibrary';
import type { ChordEvent, KeyMode, MajorKey } from '@/types';

const MODES: readonly KeyMode[] = ['major', 'minor'];

/** A progression card, with only the fields the advanced tab reads. */
function event(displayName: string, rootOffset: number): ChordEvent {
  return { id: displayName, displayName, rootOffset } as unknown as ChordEvent;
}

const C = event('C', 0);
const Dm = event('Dm', 2);
const F = event('F', 5);
const G = event('G', 7);
const Am = event('Am', 9);

function groupIds(key: MajorKey, mode: KeyMode): string[] {
  return advancedLibraryGroups(key, mode).map((group) => group.id);
}

function cardsIn(groups: ReturnType<typeof advancedLibraryGroups>, id: string) {
  return groups.find((group) => group.id === id)!.chords;
}

describe('the advanced tab presents techniques', () => {
  it('offers the six major-key techniques and the conservative minor pair', () => {
    expect(groupIds('C', 'major')).toEqual([
      'secondary-dominant',
      'passing-diminished',
      'substitute-chord',
      'chromatic-mediant',
      'augmented-connector',
    ]);
    expect(groupIds('C', 'minor')).toEqual([
      'minor-primary-dominant',
      'substitute-chord',
      'augmented-connector',
    ]);
  });

  it('names a target on every card except the colour chords', () => {
    const groups = advancedLibraryGroups('C', 'major');
    for (const group of groups) {
      if (group.id === 'chromatic-mediant') continue;
      for (const chord of group.chords) {
        expect(chord.subLabel).toBeTruthy();
      }
    }
    // Chromatic mediants are a colour, not a departure with a destination.
    for (const chord of cardsIn(groups, 'chromatic-mediant')) {
      expect(chord.subLabel).toBeUndefined();
    }
  });

  it('keeps every row short enough to read without scrolling for it', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const group of advancedLibraryGroups(key, mode)) {
          expect(group.chords.length).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});

describe('no row offers the same sound twice', () => {
  it('deduplicates by sounding notes and destination, not by chord name', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const group of advancedLibraryGroups(key, mode)) {
          const keys = group.chords.map(
            (chord) =>
              `${pitchClassSetKey(chord)}/${chord.bassOffset ?? ''}/${chord.subLabel ?? ''}`,
          );
          expect(new Set(keys).size).toBe(keys.length);
        }
      }
    }
  });

  /**
   * A diminished seventh is symmetric four ways, so `E♭dim7` and `F#dim7` sound the
   * same four notes. They are still two techniques: one arrives at `Dm`, the other at
   * `G`. Collapsing them on notes alone would delete a connector the player needs.
   */
  it('keeps one sound offered twice when it leads to two different chords', () => {
    const diminished = cardsIn(advancedLibraryGroups('C', 'major'), 'passing-diminished');
    const sameSound = diminished.filter(
      (chord) => pitchClassSetKey(chord) === pitchClassSetKey(diminished[1]!),
    );
    expect(sameSound.map((chord) => `${chord.displayName} ${chord.subLabel}`)).toEqual([
      'E♭dim7 →Dm7',
      'F#dim7 →G7',
    ]);
  });

  it('never lists all twelve augmented roots', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const augmented = cardsIn(advancedLibraryGroups(key, mode), 'augmented-connector');
        expect(augmented.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('never shows Caug and Eaug and A♭aug together', () => {
    const names = cardsIn(advancedLibraryGroups('C', 'major'), 'augmented-connector').map(
      (chord) => chord.displayName,
    );
    expect(names.filter((name) => ['Caug', 'Eaug', 'A♭aug'].includes(name))).toHaveLength(1);
  });
});

describe('the progression narrows the offer', () => {
  it('keeps only the diminished connectors this progression can reach', () => {
    const groups = advancedLibraryGroups('C', 'major', {
      progression: [C, Dm, G, C],
      selectedIndex: 0,
    });
    // #I°7 and ♭III°7 both target ii, which is in the progression; #IV°7 targets V,
    // which is too. #V°7 targets vi, which is not.
    expect(cardsIn(groups, 'passing-diminished').map((chord) => chord.subLabel)).toEqual([
      '→Dm7',
      '→Dm7',
      '→G7',
    ]);
  });

  it('leads with the augmented connector that bridges two adjacent chords', () => {
    const groups = advancedLibraryGroups('C', 'major', {
      progression: [C, F],
      selectedIndex: 0,
    });
    const augmented = cardsIn(groups, 'augmented-connector');
    expect(augmented[0]!.displayName).toBe('Caug');
    expect(augmented[0]!.subLabel).toBe('→F');
  });

  it('does not add a candidate just because the progression is unknown', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        const blind = advancedLibraryGroups(key, mode);
        const informed = advancedLibraryGroups(key, mode, {
          progression: [C, Dm, F, G, Am],
          selectedIndex: 2,
        });
        for (const group of informed) {
          const available = cardsIn(blind, group.id).map((chord) => chord.displayName);
          for (const chord of group.chords) {
            expect(available).toContain(chord.displayName);
          }
        }
      }
    }
  });

  it('carries an empty hint so a row with nothing to offer still reads', () => {
    for (const group of advancedLibraryGroups('C', 'major')) {
      if (group.chords.length > 0) continue;
      expect(group.emptyHint).toBeTruthy();
    }
    expect(
      advancedLibraryGroups('C', 'major').find((group) => group.id === 'augmented-connector')
        ?.emptyHint,
    ).toBe('この進行で使いやすい候補はありません');
  });
});

describe('Key=C acceptance', () => {
  const groups = advancedLibraryGroups('C', 'major');

  it('offers the five secondary dominants and no duplicate of the primary V7', () => {
    expect(
      cardsIn(groups, 'secondary-dominant').map(
        (chord) => `${chord.displayName} ${chord.subLabel}`,
      ),
    ).toEqual(['A7 →Dm7', 'B7 →Em7', 'C7 →Fmaj7', 'D7 →G7', 'E7 →Am7']);
  });

  it('offers the tritone substitute and the backdoor, both aimed at the tonic', () => {
    expect(
      cardsIn(groups, 'substitute-chord').map(
        (chord) => `${chord.displayName} ${chord.commonName} ${chord.subLabel}`,
      ),
    ).toEqual(['D♭7 裏コード →Cmaj7', 'B♭7 バックドア →Cmaj7']);
  });

  it('offers the four representative chromatic mediants', () => {
    expect(cardsIn(groups, 'chromatic-mediant').map((chord) => chord.displayName)).toEqual([
      'E♭maj7',
      'Emaj7',
      'A♭maj7',
      'Amaj7',
    ]);
  });
});
