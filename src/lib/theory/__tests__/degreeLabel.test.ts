import { chromaticMediantChords, passingDiminishedChords, substituteChords } from '@/data/advancedHarmonyChords';
import { augmentedConnectorCards } from '@/data/augmentedConnectors';
import {
  MAJOR_KEYS,
  degreeVariations,
  diatonicLibrary,
  diatonicSeventhLibrary,
  modalInterchange,
  secondaryDominants,
  variationChord,
} from '@/data/music';
import { minorDegreeVariations, minorVariationChord } from '@/data/minorVariations';
import { chordDegreeLabel, respellDegree } from '@/lib/theory/degreeLabel';
import { getDefinitionBySymbol } from '@/lib/theory/definitions';
import { rebaseEvent } from '@/lib/transpose';
import type { ChordEvent, ChordRootSpelling, KeyMode, LibraryChord, MajorKey } from '@/types';

const KEY: MajorKey = 'C';

function label(rootOffset: number, suffix: string, rootSpelling?: ChordRootSpelling): string {
  return chordDegreeLabel({ rootOffset, suffix, rootSpelling });
}

describe('a numeral says which degree and what quality', () => {
  it.each<[string, number, string, string]>([
    ['C', 0, '', 'I'],
    ['Dm', 2, 'm', 'ii'],
    ['Dm7', 2, 'm7', 'ii7'],
    ['Em7', 4, 'm7', 'iii7'],
    ['F', 5, '', 'IV'],
    ['Fm', 5, 'm', 'iv'],
    ['Fm7', 5, 'm7', 'iv7'],
    ['Gm7', 7, 'm7', 'v7'],
    ['B♭7', 10, '7', '♭VII7'],
    ['E♭maj7', 3, 'maj7', '♭IIImaj7'],
  ])('writes %s as %s', (_name, rootOffset, suffix, expected) => {
    expect(label(rootOffset, suffix)).toBe(expected);
  });

  /**
   * A lower-case numeral already says the chord is minor, so printing the `m` as well says
   * it twice: the fourth degree with a minor seventh is `iv7`, never `ivm7`.
   */
  it('never repeats the quality it already spelled', () => {
    expect(label(5, 'm9')).toBe('iv9');
    expect(label(5, 'm11')).toBe('iv11');
    expect(label(5, 'm6')).toBe('iv6');
    expect(label(5, 'm(add9)')).toBe('iv(add9)');
    expect(label(5, 'm7(♭13)')).toBe('iv7(♭13)');
  });

  it('writes a diminished chord with the sign a reader looks for', () => {
    expect(label(11, 'dim')).toBe('vii°');
    expect(label(11, 'dim7')).toBe('vii°7');
    expect(label(11, 'm7♭5')).toBe('vii7♭5');
  });

  it('keeps a suspended or augmented chord upper case', () => {
    expect(label(7, 'sus4')).toBe('Vsus4');
    expect(label(0, 'aug')).toBe('Iaug');
  });

  it('names a bass degree on a slash chord', () => {
    expect(chordDegreeLabel({ rootOffset: 0, suffix: '', bassOffset: 4 })).toBe('I/III');
  });
});

/**
 * `#V` and `♭VI` sound the same note and make different claims. A secondary leading-tone
 * diminished is a sharpened fifth resolving up into the sixth degree, and writing it as a
 * flattened sixth would state the opposite motion, so the rule's own spelling outranks
 * whatever the pitch alone would suggest.
 */
describe('an advanced rule keeps the spelling it meant', () => {
  it.each<[string, string]>([
    ['C#dim7', '#I°7'],
    ['E♭dim7', '♭III°7'],
    ['F#dim7', '#IV°7'],
    ['G#dim7', '#V°7'],
  ])('writes %s as %s', (displayName, expected) => {
    const card = passingDiminishedChords(KEY).find((c) => c.displayName === displayName)!;
    expect(label(card.rootOffset, card.suffix, card.rootSpelling)).toBe(expected);
  });

  it('would have written G#dim7 as a flattened sixth without the rule', () => {
    const card = passingDiminishedChords(KEY).find((c) => c.displayName === 'G#dim7')!;
    expect(label(card.rootOffset, card.suffix)).toBe('♭vi°7');
    expect(label(card.rootOffset, card.suffix, card.rootSpelling)).toBe('#V°7');
  });

  it('keeps the substitute and chromatic-mediant spellings too', () => {
    const backdoor = substituteChords(KEY, 'major').find((c) => c.displayName === 'B♭7')!;
    expect(label(backdoor.rootOffset, backdoor.suffix, backdoor.rootSpelling)).toBe('♭VII7');
    const mediant = chromaticMediantChords(KEY).find((c) => c.displayName === 'E♭maj7')!;
    expect(label(mediant.rootOffset, mediant.suffix, mediant.rootSpelling)).toBe('♭IIImaj7');
  });

  /**
   * The three categories that state no spelling do not need to: their roots are either
   * scale degrees or flat-side borrowings, where the default direction is already right.
   */
  it('needs no spelling for the categories that carry none', () => {
    const borrowed = modalInterchange(KEY);
    expect(
      borrowed.map((c) => label(c.rootOffset, c.suffix)),
    ).toEqual(['iv', 'v', '♭VII', '♭VI', '♭III']);
    expect(secondaryDominants(KEY).map((c) => label(c.rootOffset, c.suffix))).toEqual([
      'VI7',
      'VII7',
      'I7',
      'II7',
      'III7',
    ]);
    for (const c of augmentedConnectorCards(KEY, 'major')) {
      expect(label(c.rootOffset, c.suffix)).toMatch(/^[IV]+aug$/);
    }
  });
});

describe('every placeable suffix produces a label', () => {
  function placeable(): LibraryChord[] {
    const out: LibraryChord[] = [];
    for (const mode of ['major', 'minor'] as const) {
      out.push(...diatonicLibrary(KEY, mode), ...diatonicSeventhLibrary(KEY, mode));
      for (let degree = 0; degree < 7; degree += 1) {
        for (const entry of mode === 'minor' ? minorDegreeVariations(degree) : degreeVariations(degree)) {
          out.push(
            mode === 'minor'
              ? minorVariationChord(KEY, degree, entry.id)
              : variationChord(KEY, degree, entry.id),
          );
        }
      }
      out.push(...augmentedConnectorCards(KEY, mode), ...substituteChords(KEY, mode));
    }
    out.push(
      ...passingDiminishedChords(KEY),
      ...secondaryDominants(KEY),
      ...chromaticMediantChords(KEY),
      ...modalInterchange(KEY),
    );
    return out;
  }

  it('recognises every suffix, so no label is produced by guesswork', () => {
    for (const chord of placeable()) {
      if (chord.suffix === '') continue;
      expect({ suffix: chord.suffix, known: getDefinitionBySymbol(chord.suffix) != null }).toEqual({
        suffix: chord.suffix,
        known: true,
      });
    }
  });

  it('never leaves a stray quality marker in the numeral', () => {
    for (const chord of placeable()) {
      const written = label(chord.rootOffset, chord.suffix, chord.rootSpelling);
      // A minor numeral is lower case, so an `m` right after it would be the dropped marker
      // reappearing: `ivm7` rather than `iv7`. Upper-case numerals are left alone, since
      // `Imaj7` is a major seventh and not a stray marker.
      expect({ chord: chord.displayName, written }).toEqual({
        chord: chord.displayName,
        written: written.replace(/^([#♭]?[iv]+)m/, '$1'),
      });
      expect(written).not.toMatch(/dim/);
    }
  });
});

/**
 * The invariant that was broken: after a key rebase the offset moved and the spelling did
 * not, so the two described different pitches. A label that reads correctly while the
 * metadata behind it disagrees is not a pass.
 */
describe('a rebase moves the offset and the spelling together', () => {
  function event(chord: LibraryChord, mode: KeyMode = 'major'): ChordEvent {
    return {
      id: 'e',
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
      modeContext: mode,
    } as ChordEvent;
  }

  const pitchClassOf = (spelling: ChordRootSpelling): number =>
    (([0, 2, 4, 5, 7, 9, 11][spelling.degreeIndex] ?? 0) + spelling.alteration + 12) % 12;

  it('respells #V in C as #I in G, keeping the sharp direction', () => {
    const dim = passingDiminishedChords(KEY).find((c) => c.displayName === 'G#dim7')!;
    const rebased = rebaseEvent(event(dim), 'C', 'G');
    expect(rebased.rootOffset).toBe(1);
    expect(rebased.rootSpelling).toEqual({ degreeIndex: 0, alteration: 1 });
    expect(chordDegreeLabel({ ...rebased, suffix: rebased.suffix })).toBe('#I°7');
  });

  it('drops the accidental when the new pitch is a scale degree', () => {
    const mediant = chromaticMediantChords(KEY).find((c) => c.displayName === 'Emaj7')!;
    const rebased = rebaseEvent(event(mediant), 'C', 'G');
    expect(rebased.rootSpelling).toEqual({ degreeIndex: 5, alteration: 0 });
    expect(chordDegreeLabel({ ...rebased, suffix: rebased.suffix })).toBe('VImaj7');
  });

  it('keeps offset and spelling on the same pitch class, for every advanced chord and key', () => {
    const advanced = [
      ...passingDiminishedChords(KEY),
      ...substituteChords(KEY, 'major'),
      ...chromaticMediantChords(KEY),
    ];
    for (const chord of advanced) {
      for (const target of MAJOR_KEYS as readonly MajorKey[]) {
        const rebased = rebaseEvent(event(chord), KEY, target);
        expect({
          chord: chord.displayName,
          target,
          agree: pitchClassOf(rebased.rootSpelling!) === rebased.rootOffset,
        }).toEqual({ chord: chord.displayName, target, agree: true });
      }
    }
  });

  it('is unchanged when the key does not move', () => {
    for (const chord of passingDiminishedChords(KEY)) {
      const rebased = rebaseEvent(event(chord), KEY, KEY);
      expect(rebased.rootSpelling).toEqual(chord.rootSpelling);
      expect(rebased.rootOffset).toBe(chord.rootOffset);
    }
  });

  /**
   * The pitch survives a round trip; the spelling does not always. A degree that passes
   * through a natural on the way loses the direction it had — once `♭III` in C is `I` in E♭,
   * nothing records that it used to be a flat — so the guarantee is that offset and spelling
   * still describe the same note, not that the same words come back.
   */
  it('round-trips the pitch through a key and back', () => {
    for (const chord of passingDiminishedChords(KEY)) {
      const there = rebaseEvent(event(chord), KEY, 'E♭');
      const back = rebaseEvent(there, 'E♭', KEY);
      expect(back.rootOffset).toBe(chord.rootOffset);
      expect(pitchClassOf(back.rootSpelling!)).toBe(chord.rootOffset);
    }
  });

  it('never lets a minor chord be mis-cased by a rule-stated degree', () => {
    // The upper-case rule is scoped to rule-stated degrees; no minor chord carries one, and
    // this fails loudly if one ever starts to.
    const withSpelling = [
      ...passingDiminishedChords(KEY),
      ...substituteChords(KEY, 'major'),
      ...chromaticMediantChords(KEY),
    ].filter((chord) => chord.rootSpelling != null);
    expect(withSpelling.length).toBeGreaterThan(0);
    for (const chord of withSpelling) {
      expect({ chord: chord.displayName, minor: /^m($|[^a])/.test(chord.suffix) }).toEqual({
        chord: chord.displayName,
        minor: false,
      });
    }
  });
});

describe('respellDegree on its own', () => {
  it('shifts a natural degree to a natural degree', () => {
    expect(respellDegree({ degreeIndex: 0, alteration: 0 }, 7)).toEqual({
      degreeIndex: 4,
      alteration: 0,
    });
  });

  it('keeps a flat direction when the new pitch is still chromatic', () => {
    // ♭III in C is E♭; shifted down a fifth it is ♭VI of G.
    expect(respellDegree({ degreeIndex: 2, alteration: -1 }, -7)).toEqual({
      degreeIndex: 5,
      alteration: -1,
    });
  });
});
