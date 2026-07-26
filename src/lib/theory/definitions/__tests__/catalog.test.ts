import {
  CHORD_CATALOG,
  definitionIdForSuffix,
  getDefinitionById,
  getDefinitionBySymbol,
  intervalsForChord,
  intervalsForSuffix,
  pitchClassesFromIntervals,
} from '@/lib/theory/definitions';

/**
 * The interval table that shipped in App Store build 5 (previously inlined in
 * `voicing.ts`). The catalog now owns these spellings, so this table is frozen
 * here: a project saved before the Theory Engine existed must keep sounding
 * identical, and any catalog edit that would change one of these fails loudly.
 */
const BUILD_5_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'm7♭5': [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  '11': [0, 5, 7, 10, 14],
  '13': [0, 4, 7, 10, 14, 21],
  maj9: [0, 4, 7, 11, 14],
  maj13: [0, 4, 7, 11, 14, 21],
  'm(add9)': [0, 3, 7, 14],
  'm(add11)': [0, 3, 7, 17],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m13: [0, 3, 7, 10, 14, 21],
};

describe('CHORD_CATALOG integrity', () => {
  it('has unique ids and symbols', () => {
    const ids = CHORD_CATALOG.map((d) => d.id);
    const symbols = CHORD_CATALOG.map((d) => d.symbol);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('fully describes every definition', () => {
    for (const d of CHORD_CATALOG) {
      expect(d.symbol).toEqual(expect.any(String));
      expect(d.buttonLabel.length).toBeGreaterThan(0);
      expect(d.quality).toBeTruthy();
      expect(d.intervals.length).toBeGreaterThanOrEqual(3);
      expect(d.intervals[0]).toBe(0);
      expect([...d.intervals].sort((a, b) => a - b)).toEqual(d.intervals);
      expect(Array.isArray(d.extensions)).toBe(true);
      expect(Array.isArray(d.alterations)).toBe(true);
      expect(d.category).toBeTruthy();
      expect(typeof d.priority).toBe('number');
      expect(Array.isArray(d.tags)).toBe(true);
    }
  });

  it('round-trips every symbol and id through lookup', () => {
    for (const d of CHORD_CATALOG) {
      expect(getDefinitionBySymbol(d.symbol)).toBe(d);
      expect(getDefinitionById(d.id)).toBe(d);
    }
  });
});

describe('build 5 spelling is preserved', () => {
  it('reproduces every shipped suffix exactly', () => {
    for (const [suffix, intervals] of Object.entries(BUILD_5_INTERVALS)) {
      expect(getDefinitionBySymbol(suffix)).toBeDefined();
      expect(intervalsForSuffix(suffix)).toEqual(intervals);
    }
  });

  it('gives every shipped suffix a stable id to backfill with', () => {
    for (const suffix of Object.keys(BUILD_5_INTERVALS)) {
      const id = definitionIdForSuffix(suffix);
      expect(id).toBeDefined();
      expect(getDefinitionById(id!)?.symbol).toBe(suffix);
    }
  });
});

describe('intervalsForChord resolution order', () => {
  it('prefers the definition id over the suffix', () => {
    const maj7 = getDefinitionBySymbol('maj7')!;
    expect(intervalsForChord('m', maj7.id)).toEqual(maj7.intervals);
  });

  it('falls back to the suffix when no id is given', () => {
    expect(intervalsForChord('m7')).toEqual([0, 3, 7, 10]);
  });

  it('falls back to the suffix when the id is unknown', () => {
    expect(intervalsForChord('m7', 'not-a-real-id')).toEqual([0, 3, 7, 10]);
  });

  it('never returns an empty chord for unknown input', () => {
    expect(intervalsForChord('???')).toEqual([0, 4, 7]);
    expect(definitionIdForSuffix('???')).toBeUndefined();
  });
});

describe('pitchClassesFromIntervals', () => {
  it('folds extensions into a sorted, deduplicated pitch-class set', () => {
    expect(pitchClassesFromIntervals([0, 4, 7, 10, 14])).toEqual([0, 2, 4, 7, 10]);
  });
});
