import {
  availableVariations,
  CHORD_VARIATIONS,
  MAJOR_KEYS,
  diatonicLibrary,
  diatonicSevenths,
  diatonicTriads,
  modalInterchange,
  noteAt,
  secondaryDominants,
  slashChord,
  variationChord,
} from '@/data/music';

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
  it('keeps sus4/add9 free; extended tensions remain Pro', () => {
    const free = CHORD_VARIATIONS.filter((v) => !v.isPro).map((v) => v.id);
    expect(free).toEqual(['sus4', 'add9']);
    expect(CHORD_VARIATIONS.map((v) => v.id)).toEqual(expect.arrayContaining(['maj11', 'alt', 'sixNine']));
  });

  it('marks sus4/add9 free and 6th/9th Pro on built chords', () => {
    expect(variationChord('C', 0, 'sus4')).toMatchObject({ displayName: 'Csus4', isPro: false });
    expect(variationChord('C', 0, 'add9')).toMatchObject({ displayName: 'Cadd9', isPro: false });
    expect(variationChord('C', 0, '6')).toMatchObject({ displayName: 'C6', isPro: true });
    // I: 9 is voiced as maj9 (not dominant C9).
    expect(variationChord('C', 0, '9')).toMatchObject({ displayName: 'Cmaj9', isPro: true });
  });
});

describe('variationChord — quality-aware (C major, Phase 5 catalog)', () => {
  it('keeps minor degrees minor (vi + add9 → Am(add9), not the major Aadd9)', () => {
    expect(variationChord('C', 5, 'add9').displayName).toBe('Am(add9)');
    expect(variationChord('C', 5, '9').displayName).toBe('Am9');
    expect(variationChord('C', 1, '6').displayName).toBe('Dm6');
    expect(variationChord('C', 1, '13').displayName).toBe('Dm13');
  });

  it('offers practical tensions per degree without avoid-note removal', () => {
    expect(availableVariations(0)).toEqual(
      expect.arrayContaining(['sus4', 'add9', '6', 'sus2', '9', '13', 'maj11', 'sixNine']),
    );
    expect(availableVariations(5)).toEqual(
      expect.arrayContaining(['sus4', 'add9', 'sus2', '9', '11', '13', 'sixNine']),
    );
    expect(availableVariations(2)).toEqual(
      expect.arrayContaining(['sus4', 'add9', '9', '11', '13', 'nine_11']),
    );
    expect(availableVariations(6).length).toBeGreaterThan(0);
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
});

describe('noteAt', () => {
  it('spells notes at a semitone offset from the tonic', () => {
    expect(noteAt('C', 0)).toBe('C');
    expect(noteAt('C', 7)).toBe('G');
    expect(noteAt('G', 5)).toBe('C');
  });
});
