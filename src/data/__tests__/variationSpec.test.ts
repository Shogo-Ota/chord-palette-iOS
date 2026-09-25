import {
  ALL_VARIATIONS,
  MAJOR_KEYS,
  availableVariations,
  degreeVariations,
  extendedVariations,
  strongVariations,
  variationChord,
} from '@/data/music';
import { minorDegreeVariations, variationChordForMode } from '@/data/minorVariations';
import { intervalsForChord, intervalsForSuffix } from '@/lib/theory/definitions';
import type { MajorKey } from '@/types';

/**
 * The offer, degree by degree, exactly as the redesign specifies it in C major.
 *
 * This is the contract the table in `music.ts` exists to satisfy, so it is written
 * as a transcription rather than derived from the implementation: `normal` is what
 * the player reaches for without a warning, `strong` is the 強い色づけ row, and the
 * order is the order the editor shows.
 */
const SPEC: readonly { degree: number; normal: string[]; strong: string[] }[] = [
  {
    degree: 0,
    normal: ['Csus2', 'Csus4', 'Cadd9', 'C6', 'C6/9', 'Cmaj9'],
    strong: ['Cmaj7(#11)', 'Cmaj9(#11)'],
  },
  {
    degree: 1,
    normal: ['Dsus2', 'Dsus4', 'Dm(add9)', 'Dm6', 'Dm6/9', 'Dm9', 'Dm11', 'Dm13'],
    strong: [],
  },
  {
    degree: 2,
    normal: ['Esus4', 'Em(add11)', 'Em7(add11)'],
    strong: ['Em7(♭13)'],
  },
  {
    degree: 3,
    normal: ['Fsus2', 'Fadd9', 'F6', 'F6/9', 'Fmaj9'],
    strong: ['Fmaj7(#11)', 'Fmaj9(#11)', 'Fmaj13(#11)'],
  },
  {
    degree: 4,
    normal: ['Gsus2', 'Gsus4', 'Gadd9', 'G6', 'G9', 'G13'],
    strong: ['G7(♭9)', 'G7(#9)', 'G7(#11)', 'G7(♭13)'],
  },
  {
    degree: 5,
    normal: ['Asus2', 'Asus4', 'Am(add9)', 'Am9', 'Am11'],
    strong: ['Am7(♭13)'],
  },
  {
    degree: 6,
    normal: ['Bm7♭5', 'Bm7♭5(11)', 'Bdim7'],
    strong: ['Bm7♭5(♭13)'],
  },
];

/** Captions, which must read as the quality the degree actually produces. */
const SPEC_LABELS: readonly string[][] = [
  ['sus2', 'sus4', 'add9', '6', '6/9', 'maj9', 'maj7(#11)', 'maj9(#11)'],
  ['sus2', 'sus4', 'add9', 'm6', 'm6/9', 'm9', 'm11', 'm13'],
  ['sus4', 'm(add11)', 'm7(add11)', 'm7(♭13)'],
  ['sus2', 'add9', '6', '6/9', 'maj9', 'maj7(#11)', 'maj9(#11)', 'maj13(#11)'],
  ['sus2', 'sus4', 'add9', '6', '9', '13', '♭9', '#9', '#11', '♭13'],
  ['sus2', 'sus4', 'add9', 'm9', 'm11', 'm7(♭13)'],
  ['m7♭5', 'm7♭5(11)', 'dim7', 'm7♭5(♭13)'],
];

function chordsFor(degree: number, ids: string[]): string[] {
  return ids.map((id) => variationChord('C', degree, id as never).displayName);
}

describe('diatonic variation offer (C major)', () => {
  for (const { degree, normal, strong } of SPEC) {
    it(`offers degree ${degree} exactly the specified normal row, in order`, () => {
      expect(
        chordsFor(degree, [...availableVariations(degree), ...extendedVariations(degree)]),
      ).toEqual(normal);
    });

    it(`offers degree ${degree} exactly the specified 強い色づけ row, in order`, () => {
      expect(chordsFor(degree, strongVariations(degree))).toEqual(strong);
    });
  }

  it('keeps the free row reachable on every degree that has one', () => {
    // sus4 / add9 are the two free variations, and both are always in the first row.
    for (let degree = 0; degree < 7; degree += 1) {
      const primary = availableVariations(degree);
      for (const id of ['sus4', 'add9'] as const) {
        if (degreeVariations(degree).some((entry) => entry.id === id)) {
          expect(primary).toContain(id);
        }
      }
    }
  });

  it('never leaves a diatonic degree with nothing to offer', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      expect(degreeVariations(degree).length).toBeGreaterThan(0);
      expect(availableVariations(degree).length).toBeGreaterThan(0);
    }
  });

  it('does not repeat a variation across rows', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      const ids = degreeVariations(degree).map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('variation captions match the quality they produce', () => {
  it('labels every pill as its own chord quality, not the shared id', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      expect(degreeVariations(degree).map((entry) => entry.label)).toEqual(SPEC_LABELS[degree]);
    }
  });

  it('uses chord-name sixths rather than English ordinals', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const entry of degreeVariations(degree)) {
        expect(entry.label).not.toMatch(/th$/);
      }
    }
    expect(degreeVariations(0).find((e) => e.id === '6')?.label).toBe('6');
    expect(degreeVariations(1).find((e) => e.id === '6')?.label).toBe('m6');
  });

  it('carries the caption onto the built chord, so card rows cannot disagree', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const entry of degreeVariations(degree)) {
        const chord = variationChord('C', degree, entry.id);
        expect(chord.subLabel).toBe(entry.label);
        expect(chord.displayName.endsWith(entry.suffix)).toBe(true);
      }
    }
  });
});

describe('candidates the redesign removed', () => {
  const removed: readonly { degree: number; chord: string }[] = [
    // The E–F semitone makes this the easiest chord to pick by accident.
    { degree: 2, chord: 'Em7(♭9)' },
    // Same rub a fifth up: B–C.
    { degree: 6, chord: 'Bm7♭5(♭9)' },
    // Too close to the maj9 beside it to be worth a slot.
    { degree: 0, chord: 'Cmaj13' },
    { degree: 0, chord: 'Cmaj13(#11)' },
    { degree: 3, chord: 'Fmaj13' },
    // Named the same notes as Dm13 twice.
    { degree: 1, chord: 'Dm13(9,11)' },
  ];

  for (const { degree, chord } of removed) {
    it(`no longer offers ${chord} on any row`, () => {
      const offered = chordsFor(
        degree,
        degreeVariations(degree).map((entry) => entry.id),
      );
      expect(offered).not.toContain(chord);
    });
  }

  it('still sounds a project saved with a removed candidate', () => {
    // Removing a candidate must not silence work already on disk: a saved event
    // carries its own suffix, which the catalog keeps spelling.
    for (const suffix of ['maj13', 'maj13(#11)', 'm13(9,11)', 'm7(♭9)', 'm7♭5(♭9)']) {
      expect(intervalsForSuffix(suffix).length).toBeGreaterThan(0);
    }
  });
});

describe('variation metadata for a later context-aware ranker', () => {
  it('separates an in-key rub from a tension that leaves the key', () => {
    const inKeyRub = degreeVariations(5).find((entry) => entry.id === 'm7b13')!;
    expect(inKeyRub).toMatchObject({
      colorClass: 'minorColor',
      scaleCompatibility: 'inside',
      dissonanceLevel: 'high',
    });

    const outOfKey = degreeVariations(4).find((entry) => entry.id === 'dom7b9')!;
    expect(outOfKey).toMatchObject({
      colorClass: 'alteredDominant',
      scaleCompatibility: 'outside',
    });
  });

  it('knows IV #11 is diatonic while I #11 is not', () => {
    expect(degreeVariations(3).find((e) => e.id === 'maj7sharp11')).toMatchObject({
      colorClass: 'lydian',
      scaleCompatibility: 'inside',
    });
    expect(degreeVariations(0).find((e) => e.id === 'maj7sharp11')).toMatchObject({
      colorClass: 'lydian',
      scaleCompatibility: 'outside',
    });
  });

  it('marks every 強い色づけ entry as either outside the key or a high rub', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const entry of degreeVariations(degree)) {
        if (entry.usability !== 'advanced') continue;
        expect(
          entry.scaleCompatibility === 'outside' || entry.dissonanceLevel !== 'low',
        ).toBe(true);
      }
    }
  });

  it('keeps every always-visible entry inside the key', () => {
    for (const degree of [0, 1, 2, 3, 4, 5, 6]) {
      for (const entry of degreeVariations(degree)) {
        if (entry.usability !== 'primary') continue;
        expect(entry.scaleCompatibility).toBe('inside');
        expect(entry.dissonanceLevel).toBe('low');
      }
    }
  });
});

describe('every key spells every variation', () => {
  for (const mode of ['major', 'minor'] as const) {
    it(`resolves and spells every offer in all 12 keys — ${mode}`, () => {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (let degree = 0; degree < 7; degree += 1) {
          const offered = mode === 'minor' ? minorDegreeVariations(degree) : degreeVariations(degree);
          for (const entry of offered) {
            const chord = variationChordForMode(key, degree, entry.id, mode);

            expect(chord.suffix).toBe(entry.suffix);
            expect(chord.subLabel).toBe(entry.label);
            expect(chord.variation).toBe(entry.id);
            expect(chord.definitionId).toBeDefined();
            expect(intervalsForChord(chord.suffix, chord.definitionId).length).toBeGreaterThan(0);

            // The root is the key's own spelling, and the suffix never touches it.
            expect(chord.displayName).toBe(
              `${chord.displayName.slice(0, chord.displayName.length - entry.suffix.length)}${entry.suffix}`,
            );
            expect(chord.rootOffset).toBeGreaterThanOrEqual(0);
            expect(chord.rootOffset).toBeLessThan(12);
          }
        }
      }
    });
  }

  it('transposes by degree, keeping quality and caption identical across keys', () => {
    for (let degree = 0; degree < 7; degree += 1) {
      for (const entry of degreeVariations(degree)) {
        const inC = variationChord('C', degree, entry.id);
        for (const key of MAJOR_KEYS as readonly MajorKey[]) {
          const moved = variationChord(key, degree, entry.id);
          expect(moved.suffix).toBe(inC.suffix);
          expect(moved.subLabel).toBe(inC.subLabel);
          expect(moved.rootOffset).toBe(inC.rootOffset);
          expect(moved.isPro).toBe(inC.isPro);
        }
      }
    }
  });

  it('keeps the enharmonic spelling each key already used', () => {
    expect(variationChord('D♭', 0, 'add9').displayName).toBe('D♭add9');
    // G♭ major spells its IV as C♭, not B — the variation must not "simplify" it.
    expect(variationChord('G♭', 3, '6').displayName).toBe('C♭6');
    expect(variationChord('B', 6, 'm7b5').displayName).toBe('A#m7♭5');
    expect(variationChord('E♭', 4, 'dom7b9').displayName).toBe('B♭7(♭9)');
  });
});

describe('Pro gating', () => {
  it('keeps sus4 / add9 free and prices every added colour', () => {
    const free = ALL_VARIATIONS.filter((v) => !v.isPro).map((v) => v.id);
    // m7♭5 joins the free set because the seventh grid already gives it away.
    expect(free).toEqual(['sus4', 'add9', 'm7b5']);
  });

  it('prices vii° the way the rest of the library already does', () => {
    expect(variationChord('C', 6, 'm7b5').isPro).toBe(false);
    expect(variationChord('C', 6, 'dim7').isPro).toBe(true);
  });
});
