/**
 * Natural-minor data layer.
 *
 * Two things are worth protecting here. The spellings are hand-written orthography, so
 * they are checked against the interval pattern rather than trusted. And the degree
 * table is derived from the theory DB, so the test states what the derivation is
 * expected to produce — if the book table is edited, this is where it surfaces.
 */

import {
  MAJOR_KEYS,
  diatonicSevenths,
  diatonicTriads,
  keyDisplayName,
  keyTonicPc,
  offsetFromTonic,
} from '@/data/music';
import {
  MINOR_DEGREE_FUNCTIONS,
  MINOR_DEGREE_LABELS,
  MINOR_SCALE_OFFSETS,
  MINOR_SCALES,
  MINOR_SEVENTH_SUFFIXES,
  MINOR_TRIAD_SUFFIXES,
  minorDegreeIndexFromRootOffset,
  minorTonicName,
} from '@/data/minorMode';

const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];

describe('natural-minor scale spellings', () => {
  it('spells all 12 keys at natural-minor intervals', () => {
    const wrong = MAJOR_KEYS.filter((key) => {
      const offsets = MINOR_SCALES[key].map((note) => offsetFromTonic(key, note));
      return offsets.join() !== NATURAL_MINOR.join();
    }).map((key) => `${key}m: ${MINOR_SCALES[key].join(' ')}`);
    expect(wrong).toEqual([]);
  });

  it('never needs a double accidental', () => {
    const doubled = MAJOR_KEYS.flatMap((key) =>
      MINOR_SCALES[key].filter((note) => /♭♭|##/.test(note)).map((note) => `${key}m: ${note}`),
    );
    expect(doubled).toEqual([]);
  });

  it('respells the three tonics that would otherwise need double flats', () => {
    expect(minorTonicName('D♭')).toBe('C#');
    expect(minorTonicName('G♭')).toBe('F#');
    expect(minorTonicName('A♭')).toBe('G#');
  });

  it('keeps every other tonic spelled as the key is named', () => {
    for (const key of MAJOR_KEYS) {
      if (['D♭', 'G♭', 'A♭'].includes(key)) continue;
      expect(minorTonicName(key)).toBe(key);
    }
  });

  /**
   * The claim that lets minor ship without re-auditioning the accompaniment: mode
   * changes letters, not pitch. If this breaks, switching mode moves audible notes.
   */
  it('leaves the tonic pitch class untouched by the respelling', () => {
    for (const key of MAJOR_KEYS) {
      expect(offsetFromTonic(key, MINOR_SCALES[key][0])).toBe(0);
      expect(keyTonicPc(key)).toBe(keyTonicPc(key));
    }
    expect(keyTonicPc('A♭')).toBe(8);
    expect(keyTonicPc('D♭')).toBe(1);
    expect(keyTonicPc('G♭')).toBe(6);
  });
});

describe('degree table derived from the theory DB', () => {
  it('uses the natural-minor offsets', () => {
    expect([...MINOR_SCALE_OFFSETS]).toEqual(NATURAL_MINOR);
  });

  it('labels the degrees in the app orthography', () => {
    expect([...MINOR_DEGREE_LABELS]).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
  });

  it('maps qualities to catalog suffixes', () => {
    expect([...MINOR_TRIAD_SUFFIXES]).toEqual(['m', 'dim', '', 'm', 'm', '', '']);
    expect([...MINOR_SEVENTH_SUFFIXES]).toEqual(['m7', 'm7♭5', 'maj7', 'm7', 'm7', 'maj7', '7']);
  });

  /**
   * Five functions come from the book. `v` and `♭VII` are Chord Palette policy, because
   * the book assigns them none and a card still needs a colour.
   */
  it('assigns a function to every degree, including the two the book leaves open', () => {
    expect([...MINOR_DEGREE_FUNCTIONS]).toEqual([
      'tonic',
      'subdominant',
      'tonic',
      'subdominant',
      'dominant',
      'subdominant',
      'subdominant',
    ]);
  });

  it('finds the degree index for in-scale roots and rejects the rest', () => {
    NATURAL_MINOR.forEach((offset, index) => {
      expect(minorDegreeIndexFromRootOffset(offset)).toBe(index);
    });
    for (const outside of [1, 4, 6, 9, 11]) {
      expect(minorDegreeIndexFromRootOffset(outside)).toBe(-1);
    }
  });
});

describe('diatonic chords in minor', () => {
  it('builds the A minor set the way a lead sheet writes it', () => {
    expect(diatonicTriads('A', 'minor').map((c) => c.displayName)).toEqual([
      'Am',
      'Bdim',
      'C',
      'Dm',
      'Em',
      'F',
      'G',
    ]);
    expect(diatonicSevenths('A', 'minor').map((c) => c.displayName)).toEqual([
      'Am7',
      'Bm7♭5',
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
    ]);
  });

  it('stamps minor degree labels and offsets on the cards', () => {
    const cards = diatonicSevenths('A', 'minor');
    expect(cards.map((c) => c.degreeLabel)).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
    expect(cards.map((c) => c.rootOffset)).toEqual(NATURAL_MINOR);
  });

  it('resolves a catalog definition for every minor diatonic chord in every key', () => {
    for (const key of MAJOR_KEYS) {
      for (const card of [...diatonicTriads(key, 'minor'), ...diatonicSevenths(key, 'minor')]) {
        expect({ key, name: card.displayName, id: card.definitionId }).toEqual({
          key,
          name: card.displayName,
          id: expect.any(String),
        });
        expect(card.definitionId).not.toBe('');
      }
    }
  });

  it('shows the tonic as it is written in the chosen mode', () => {
    expect(keyDisplayName('C')).toBe('C');
    expect(keyDisplayName('C', 'minor')).toBe('C');
    // The three respelled tonics: D♭ / G♭ / A♭ minor would need double flats.
    expect(keyDisplayName('D♭', 'minor')).toBe('C#');
    expect(keyDisplayName('G♭', 'minor')).toBe('F#');
    expect(keyDisplayName('A♭', 'minor')).toBe('G#');
    // Respelling is orthography only — the tonic pitch is untouched.
    expect(MAJOR_KEYS.map((k) => offsetFromTonic(k, keyDisplayName(k, 'minor')))).toEqual(
      MAJOR_KEYS.map(() => 0),
    );
  });

  it('defaults to major so every pre-minor call site is unchanged', () => {
    expect(diatonicTriads('C').map((c) => c.displayName)).toEqual(
      diatonicTriads('C', 'major').map((c) => c.displayName),
    );
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
