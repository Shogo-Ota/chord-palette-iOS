import { chordPitchClasses, pitchClassSetKey } from '@/data/chordPitchClassSet';
import { MAJOR_KEYS, diatonicLibrary, diatonicSeventhLibrary } from '@/data/music';
import { advancedLibraryGroups } from '@/features/editor/advancedLibrary';
import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import type { ChordEvent, KeyMode, LibraryChord, MajorKey } from '@/types';

const KEY: MajorKey = 'C';

/** What the editor stores when a library card is tapped. */
function placed(chord: LibraryChord, mode: KeyMode = 'major'): ChordEvent {
  return {
    id: chord.id,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: !!chord.isPro,
    rootOffset: chord.rootOffset,
    rootSpelling: chord.rootSpelling,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    category: chord.category,
    keyContext: KEY,
    modeContext: mode,
  } as ChordEvent;
}

function borrowedCards(key: MajorKey = KEY): LibraryChord[] {
  return advancedLibraryGroups(key, 'major').find((g) => g.id === 'modal-interchange')!.chords;
}

describe('A–D. the advanced tab can place a borrowed chord', () => {
  it('offers the group, between the substitutes and the colour chords', () => {
    expect(advancedLibraryGroups(KEY, 'major').map((g) => g.id)).toEqual([
      'secondary-dominant',
      'passing-diminished',
      'substitute-chord',
      'modal-interchange',
      'chromatic-mediant',
      'augmented-connector',
    ]);
  });

  it('offers exactly the five chords the theory table already defined', () => {
    expect(borrowedCards().map((c) => c.displayName)).toEqual(['Fm', 'Gm', 'B♭', 'A♭', 'E♭']);
  });

  it('stamps every card as borrowed, and prices it as Pro', () => {
    for (const card of borrowedCards()) {
      expect({ chord: card.displayName, category: card.category, pro: card.isPro }).toEqual({
        chord: card.displayName,
        category: 'modalInterchange',
        pro: true,
      });
    }
  });

  it('keeps the function each chord was already defined with', () => {
    expect(borrowedCards().map((c) => `${c.displayName}=${c.function}`)).toEqual([
      'Fm=subdominant',
      'Gm=dominant',
      'B♭=subdominant',
      'A♭=subdominant',
      'E♭=tonic',
    ]);
  });

  /** A lower-case numeral is how a reader is told the chord is minor. `IVm` said it twice. */
  it('writes the numeral from the quality, so the borrowed fourth reads iv', () => {
    expect(borrowedCards().map((c) => c.degreeLabel)).toEqual(['iv', 'v', '♭VII', '♭VI', '♭III']);
  });

  it('carries the metadata through to a placed event in every key', () => {
    for (const key of MAJOR_KEYS as readonly MajorKey[]) {
      for (const card of borrowedCards(key)) {
        const event = placed(card);
        expect({ key, chord: card.displayName, category: event.category }).toEqual({
          key,
          chord: card.displayName,
          category: 'modalInterchange',
        });
      }
    }
  });
});

describe('E–F. the video treats a borrowed chord as advanced harmony', () => {
  it('gives each one the role its function maps to', () => {
    const roles = borrowedCards().map((card) => {
      const [entry] = harmonicRoleVisuals([placed(card)]);
      return `${card.displayName}=${entry?.role}`;
    });
    expect(roles).toEqual(['Fm=motion', 'Gm=tension', 'B♭=motion', 'A♭=motion', 'E♭=stable']);
  });

  it('paints the borrowed subdominant green/teal', () => {
    const fm = borrowedCards().find((c) => c.displayName === 'Fm')!;
    const [entry] = harmonicRoleVisuals([placed(fm)]);
    expect(entry!.main).toBe('#34d399');
  });
});

/**
 * G–I. The same three notes, two different claims. In C minor `Fm` is the ordinary iv; in C
 * major it is taken from somewhere else. The app records which was meant and does not try to
 * work it out from the pitches.
 */
describe('G–I. a minor-mode iv is not a borrowed chord', () => {
  const minorGridFm = () => diatonicLibrary(KEY, 'minor').find((c) => c.displayName === 'Fm')!;

  it('stays diatonic when taken from the minor grid', () => {
    const event = placed(minorGridFm(), 'minor');
    expect(event.category).toBe('diatonic');
    expect(event.modeContext).toBe('minor');
  });

  it('renders as it always did in a minor song', () => {
    expect(harmonicRoleVisuals([placed(minorGridFm(), 'minor')], 'minor')).toEqual([]);
  });

  /**
   * In a major song the same chord is borrowed, and which grid it was taken from does not enter
   * into it. The palette is a view; the song's mode is the claim the video answers to.
   */
  it('becomes borrowed once the song is major, whichever grid it came from', () => {
    for (const palette of ['minor', 'major'] as const) {
      expect(harmonicRoleVisuals([placed(minorGridFm(), palette)], 'major')).toHaveLength(1);
    }
  });

  it('sounds identical to the borrowed one while reading differently', () => {
    const borrowed = borrowedCards().find((c) => c.displayName === 'Fm')!;
    const minorGrid = minorGridFm();
    expect(chordPitchClasses(minorGrid)).toEqual(chordPitchClasses(borrowed));
    expect(minorGrid.category).not.toBe(borrowed.category);
  });

  it('keeps the seventh grid diatonic too', () => {
    const fm7 = diatonicSeventhLibrary(KEY, 'minor').find((c) => c.displayName === 'Fm7')!;
    expect(placed(fm7, 'minor').category).toBe('diatonic');
    expect(harmonicRoleVisuals([placed(fm7, 'minor')], 'minor')).toEqual([]);
  });
});

/**
 * The reason this group was held back before: `♭VI` and `♭III` share a root with the
 * chromatic mediants' `♭VImaj7` and `♭IIImaj7`. They are triads against major sevenths, so
 * they do not sound the same and the dedupe cannot collapse them.
 */
describe('8. the borrowed triads do not collide with the chromatic mediants', () => {
  it('sounds different from the mediant built on the same root', () => {
    const groups = advancedLibraryGroups(KEY, 'major');
    const mediants = groups.find((g) => g.id === 'chromatic-mediant')!.chords;
    for (const [borrowedName, mediantName] of [
      ['A♭', 'A♭maj7'],
      ['E♭', 'E♭maj7'],
    ] as const) {
      const borrowed = borrowedCards().find((c) => c.displayName === borrowedName)!;
      const mediant = mediants.find((c) => c.displayName === mediantName)!;
      expect(borrowed.rootOffset).toBe(mediant.rootOffset);
      expect(pitchClassSetKey(borrowed)).not.toBe(pitchClassSetKey(mediant));
    }
  });

  it('survives the dedupe even when both rows are merged', () => {
    const groups = advancedLibraryGroups(KEY, 'major');
    const merged = [
      ...groups.find((g) => g.id === 'modal-interchange')!.chords,
      ...groups.find((g) => g.id === 'chromatic-mediant')!.chords,
    ];
    const keys = merged.map((c) => `${pitchClassSetKey(c)}/${c.subLabel ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every row free of duplicates in all 12 keys', () => {
    for (const key of MAJOR_KEYS as readonly MajorKey[]) {
      for (const group of advancedLibraryGroups(key, 'major')) {
        const keys = group.chords.map(
          (c) => `${pitchClassSetKey(c)}/${c.bassOffset ?? ''}/${c.subLabel ?? ''}`,
        );
        expect({ key, group: group.id, unique: new Set(keys).size }).toEqual({
          key,
          group: group.id,
          unique: keys.length,
        });
      }
    }
  });
});

describe('minor mode is left alone', () => {
  it('offers no borrowing group, since the minor tables were never sourced', () => {
    expect(advancedLibraryGroups(KEY, 'minor').map((g) => g.id)).toEqual([
      'minor-primary-dominant',
      'substitute-chord',
      'augmented-connector',
    ]);
  });
});
