import {
  availableVariations,
  CHORD_VARIATIONS,
  MAJOR_KEYS,
  degreeLabelFromOffset,
  diatonicLibrary,
  diatonicSevenths,
  diatonicTriads,
  EXTENDED_VARIATIONS,
  extendedVariations,
  modalInterchange,
  noteAt,
  secondaryDominants,
  slashChord,
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

describe('CHORD_VARIATIONS (Pro gating, requirements §7)', () => {
  it('offers sus4/add9 free and 6th/sus2/9/11/13 as Pro, without 5th', () => {
    const ids = CHORD_VARIATIONS.map((v) => v.id);
    expect(ids).toEqual(['sus4', 'add9', '6', 'sus2', '9', '11', '13']);
    expect(ids).not.toContain('5');
    const free = CHORD_VARIATIONS.filter((v) => !v.isPro).map((v) => v.id);
    expect(free).toEqual(['sus4', 'add9']);
  });

  it('marks sus4/add9 free and 6th/9th Pro on built chords', () => {
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

  it('offers only diatonic tensions per degree and none on vii°', () => {
    // I: no ♮11.
    expect(availableVariations(0)).toEqual(['sus4', 'add9', '6', 'sus2', '9', '13']);
    // vi: no ♮6 / 13 (F# is out of key).
    expect(availableVariations(5)).toEqual(['sus4', 'add9', 'sus2', '9', '11']);
    // iii (Phrygian): only the 4/11 avoid the ♭9/♭13.
    expect(availableVariations(2)).toEqual(['sus4', '11']);
    // vii° (diminished): no variations offered.
    expect(availableVariations(6)).toEqual([]);
  });
});

describe('extendedVariations — second tier (C major)', () => {
  it('keeps the core tier free of the extended ids', () => {
    const extendedIds: string[] = EXTENDED_VARIATIONS.map((v) => v.id);
    for (let degree = 0; degree < 7; degree += 1) {
      expect(availableVariations(degree).filter((id) => extendedIds.includes(id))).toEqual([]);
    }
  });

  it('offers only in-key, avoid-note-safe colours per degree', () => {
    expect(extendedVariations(0)).toEqual(['sixNine']);
    // ii (Dorian): the one minor degree whose ♮6 and ♮11 are both in key.
    expect(extendedVariations(1)).toEqual(['m6nine', 'm13_9_11']);
    // IV (Lydian): the only degree that can carry a #11.
    expect(extendedVariations(3)).toEqual(['sixNine', 'maj9sharp11', 'maj13sharp11']);
    // vii° gains its first colours: 11 and ♭13 are diatonic over m7♭5.
    expect(extendedVariations(6)).toEqual(['m7b5_11', 'm7b5_b13']);
    // iii / V / vi: everything left would leave the key or duplicate the core tier.
    expect(extendedVariations(2)).toEqual([]);
    expect(extendedVariations(4)).toEqual([]);
    expect(extendedVariations(5)).toEqual([]);
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
    expect(EXTENDED_VARIATIONS.every((v) => v.isPro)).toBe(true);
  });
});

describe('Pro-only chord categories (requirements §7)', () => {
  it('marks all secondary dominants Pro', () => {
    const sec = secondaryDominants('C');
    expect(sec.length).toBeGreaterThan(0);
    expect(sec.every((c) => c.isPro === true)).toBe(true);
    expect(sec[0]).toMatchObject({ displayName: 'A7', degreeLabel: 'V7/ii' });
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
