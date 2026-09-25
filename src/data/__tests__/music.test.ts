import {
  ALL_VARIATIONS,
  availableVariations,
  MAJOR_KEYS,
  degreeLabelFromOffset,
  degreeVariations,
  diatonicLibrary,
  diatonicSevenths,
  diatonicTriads,
  extendedVariations,
  modalInterchange,
  noteAt,
  secondaryDominants,
  slashChord,
  strongVariations,
  variationChord,
} from '@/data/music';
import { intervalsForChord } from '@/lib/theory/definitions';

describe('diatonicSevenths', () => {
  it('builds the C major seventh chords', () => {
    expect(diatonicSevenths('C').map((c) => c.displayName)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7♭5',
    ]);
  });

  it('labels degrees and harmonic functions', () => {
    const chords = diatonicSevenths('C');
    expect(chords[0].degreeLabel).toBe('I');
    expect(chords[0].function).toBe('tonic');
    expect(chords[3].function).toBe('subdominant'); // IV
    expect(chords[4].function).toBe('dominant'); // V
  });

  it('transposes correctly to G major', () => {
    const chords = diatonicSevenths('G');
    expect(chords[0].displayName).toBe('Gmaj7');
    expect(chords[6].displayName).toBe('F#m7♭5');
  });
});

describe('diatonicTriads', () => {
  it('builds the C major triads', () => {
    expect(diatonicTriads('C').map((c) => c.displayName)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim',
    ]);
  });
});

describe('MAJOR_KEYS', () => {
  it('exposes exactly the 12 major keys', () => {
    expect(MAJOR_KEYS).toHaveLength(12);
    expect(MAJOR_KEYS[0]).toBe('C');
  });
});

describe('diatonicLibrary', () => {
  it('is never Pro-locked (basic chords are free)', () => {
    expect(diatonicLibrary('C').every((c) => c.isPro === false)).toBe(true);
  });
});

describe('variation registry (Pro gating, requirements §7)', () => {
  it('keeps sus4/add9 free and prices every colour, without a bare 5th', () => {
    const ids: string[] = ALL_VARIATIONS.map((v) => v.id);
    expect(ids).not.toContain('5');
    // m7♭5 is free because the seventh grid already gives vii° away for free.
    expect(ALL_VARIATIONS.filter((v) => !v.isPro).map((v) => v.id)).toEqual([
      'sus4',
      'add9',
      'm7b5',
    ]);
  });

  it('marks sus4/add9 free and 6/9 Pro on built chords', () => {
    expect(variationChord('C', 0, 'sus4')).toMatchObject({ displayName: 'Csus4', isPro: false });
    expect(variationChord('C', 0, 'add9')).toMatchObject({ displayName: 'Cadd9', isPro: false });
    expect(variationChord('C', 0, '6')).toMatchObject({ displayName: 'C6', isPro: true });
    // I (Ionian): the ♮11 is an avoid note, so 9 is voiced as maj9 (not dominant C9).
    expect(variationChord('C', 0, '9')).toMatchObject({ displayName: 'Cmaj9', isPro: true });
  });
});

describe('variationChord — quality-aware, avoid-note-safe (C major)', () => {
  it('keeps minor degrees minor (vi + add9 → Am(add9), not the major Aadd9)', () => {
    expect(variationChord('C', 5, 'add9').displayName).toBe('Am(add9)');
    expect(variationChord('C', 5, '9').displayName).toBe('Am9');
    expect(variationChord('C', 1, '6').displayName).toBe('Dm6');
    expect(variationChord('C', 1, '13').displayName).toBe('Dm13');
  });

  it('offers a usable first row on every degree, sized to what the degree carries', () => {
    // I: no ♮11, and sus2 leads because it is the least committal colour.
    expect(availableVariations(0)).toEqual(['sus2', 'sus4', 'add9', '6']);
    // vi: no ♮6 / 13 (F# is out of key).
    expect(availableVariations(5)).toEqual(['sus2', 'sus4', 'add9']);
    // iii (Phrygian): the 4 and the 11 are the only forms that dodge its ♭9/♭13.
    expect(availableVariations(2)).toEqual(['sus4', '11']);
    // vii° is reachable now — the plain half-diminished seventh is its first row.
    expect(availableVariations(6)).toEqual(['m7b5']);
  });
});

describe('extendedVariations — the folded row of safe colours (C major)', () => {
  it('never repeats an id the first row already showed', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      const primary = availableVariations(degree);
      expect(extendedVariations(degree).filter((id) => primary.includes(id))).toEqual([]);
    }
  });

  it('carries the richer in-key colours per degree', () => {
    expect(extendedVariations(0)).toEqual(['sixNine', '9']);
    // ii (Dorian): the one minor degree whose ♮6 and ♮11 are both in key.
    expect(extendedVariations(1)).toEqual(['m6nine', '9', '11', '13']);
    // IV (Lydian): 6/9 and maj9; its #11 family is strong colour, not a safe one.
    expect(extendedVariations(3)).toEqual(['sixNine', '9']);
    // vii°: the diatonic 11th, plus dim7 for how clearly it resolves to I.
    expect(extendedVariations(6)).toEqual(['m7b5_11', 'dim7']);
  });

  it('builds the degree-correct symbol and is spelled by the catalog', () => {
    expect(variationChord('C', 3, 'maj9sharp11').displayName).toBe('Fmaj9(#11)');
    expect(variationChord('C', 1, 'm6nine').displayName).toBe('Dm6/9');
    expect(variationChord('C', 6, 'm7b5_b13').displayName).toBe('Bm7♭5(♭13)');
    for (let degree = 0; degree < 7; degree += 1) {
      for (const id of extendedVariations(degree)) {
        const chord = variationChord('C', degree, id);
        expect(chord.definitionId).toBeDefined();
        expect(intervalsForChord(chord.suffix, chord.definitionId).length).toBeGreaterThan(0);
      }
    }
  });

  it('is Pro-gated in full', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const id of extendedVariations(degree)) {
        expect(variationChord('C', degree, id).isPro).toBe(true);
      }
    }
  });
});

/**
 * The 強い色づけ row: a deliberate character rather than a safe colour. Membership
 * follows how strongly a tension colours the degree, which is why IV's diatonic #11
 * belongs here while its 6/9 does not.
 */
describe('strongVariations — the 強い色づけ row (C major)', () => {
  it('gives each degree the character tensions worth offering', () => {
    expect(strongVariations(0).map((id) => variationChord('C', 0, id).displayName)).toEqual([
      'Cmaj7(#11)',
      'Cmaj9(#11)',
    ]);
    expect(strongVariations(2).map((id) => variationChord('C', 2, id).displayName)).toEqual([
      'Em7(♭13)',
    ]);
    expect(strongVariations(3).map((id) => variationChord('C', 3, id).displayName)).toEqual([
      'Fmaj7(#11)',
      'Fmaj9(#11)',
      'Fmaj13(#11)',
    ]);
    expect(strongVariations(4).map((id) => variationChord('C', 4, id).displayName)).toEqual([
      'G7(♭9)',
      'G7(#9)',
      'G7(#11)',
      'G7(♭13)',
    ]);
    expect(strongVariations(5).map((id) => variationChord('C', 5, id).displayName)).toEqual([
      'Am7(♭13)',
    ]);
    expect(strongVariations(6).map((id) => variationChord('C', 6, id).displayName)).toEqual([
      'Bm7♭5(♭13)',
    ]);
  });

  it('leaves ii empty — every tension Dorian takes is already a safe colour', () => {
    expect(strongVariations(1)).toEqual([]);
  });

  it('never leaks into the two safe rows', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      const strong = strongVariations(degree);
      expect(availableVariations(degree).filter((id) => strong.includes(id))).toEqual([]);
      expect(extendedVariations(degree).filter((id) => strong.includes(id))).toEqual([]);
    }
  });

  it('is spelled by the catalog and Pro-gated in full', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const id of strongVariations(degree)) {
        const chord = variationChord('C', degree, id);
        expect(chord.definitionId).toBeDefined();
        expect(chord.isPro).toBe(true);
        expect(intervalsForChord(chord.suffix, chord.definitionId).length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Leaving the key is not by itself a reason to fold a chord away: Bdim7 is a safe
   * colour precisely because the departure is the whole point, and the ear hears it
   * resolve. Holding a semitone rub is the line that matters, because that is what
   * turns a wrong voicing into a wrong-sounding chord.
   */
  it('is the only row allowed to hold a semitone rub', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const entry of degreeVariations(degree)) {
        if (entry.usability === 'advanced') continue;
        expect(entry.dissonanceLevel).not.toBe('high');
      }
    }
  });

  it('keeps the always-visible row inside the key and forgiving of voicing', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const id of availableVariations(degree)) {
        const entry = degreeVariations(degree).find((e) => e.id === id)!;
        expect(entry.scaleCompatibility).toBe('inside');
        expect(entry.dissonanceLevel).toBe('low');
      }
    }
  });
});

describe('Pro-only chord categories (requirements §7)', () => {
  it('marks all secondary dominants Pro', () => {
    const sec = secondaryDominants('C');
    expect(sec.length).toBeGreaterThan(0);
    expect(sec.every((c) => c.isPro === true)).toBe(true);
    expect(sec.map((c) => [c.displayName, c.degreeLabel])).toEqual([
      ['A7', 'VI7'],
      ['B7', 'VII7'],
      ['C7', 'I7'],
      ['D7', 'II7'],
      ['E7', 'III7'],
    ]);
  });

  it('uses the same simple root-degree labels in all 12 keys', () => {
    for (const key of MAJOR_KEYS) {
      const sec = secondaryDominants(key);
      expect(sec.map((c) => c.degreeLabel)).toEqual(['VI7', 'VII7', 'I7', 'II7', 'III7']);
      expect(sec.every((c) => c.subLabel?.startsWith('→'))).toBe(true);
    }
  });

  it('marks all modal-interchange (borrowed) chords Pro', () => {
    const modal = modalInterchange('C');
    expect(modal.length).toBeGreaterThan(0);
    expect(modal.every((c) => c.isPro === true)).toBe(true);
  });

  it('marks slash / on-chords Pro', () => {
    const target = diatonicLibrary('C')[0];
    const slash = slashChord('C', target, 'E');
    expect(slash).toMatchObject({ displayName: 'C/E', bassNote: 'E', isPro: true });
  });

  it('labels the on-chord bass as a DEGREE, not a note name', () => {
    // C/E in C: bass E is the 3rd degree → "I/III". Name stays alphabetic ("C/E").
    const cOverE = slashChord('C', diatonicLibrary('C')[0], 'E');
    expect(cOverE.degreeLabel).toBe('I/III');
    // Chromatic bass keeps ♭/# degree spelling: G/A♭ → bass ♭VI.
    const gOverAb = slashChord('C', diatonicLibrary('C')[4], 'A♭'); // G is diatonic[4]
    expect(gOverAb.displayName).toBe('G/A♭');
    expect(gOverAb.degreeLabel).toBe('V/♭VI');
  });
});

describe('degreeLabelFromOffset', () => {
  it('maps semitone offsets to key-invariant Roman degrees', () => {
    expect(degreeLabelFromOffset(0)).toBe('I');
    expect(degreeLabelFromOffset(4)).toBe('III');
    expect(degreeLabelFromOffset(6)).toBe('#IV');
    expect(degreeLabelFromOffset(8)).toBe('♭VI');
    expect(degreeLabelFromOffset(10)).toBe('♭VII');
    expect(degreeLabelFromOffset(12)).toBe('I'); // wraps
  });
});

describe('noteAt', () => {
  it('spells notes at a semitone offset from the tonic', () => {
    expect(noteAt('C', 0)).toBe('C');
    expect(noteAt('C', 7)).toBe('G');
    expect(noteAt('G', 5)).toBe('C');
  });
});
