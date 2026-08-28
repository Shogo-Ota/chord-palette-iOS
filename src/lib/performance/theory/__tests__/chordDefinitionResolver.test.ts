/**
 * How far apart are the shipped chord vocabulary and the theory database?
 *
 * This is the measurement the theory-layer work was authorised to produce. Before deciding
 * whether to build tension and chord-scale providers on top of the database, it is worth
 * knowing in numbers — not in impressions — how much of what Chord Palette already plays the
 * database can even describe.
 *
 * The counts are pinned rather than merely computed, so a later change to either side shows
 * up as a reviewable diff. A rise means the vocabularies drifted apart; a fall means one of
 * them grew to cover the other.
 */

import {
  CHORD_QUALITIES,
  CHORD_FORMULAS,
  TENSION_TO_SEMITONE,
  degreePitchClasses,
} from '@/lib/musicTheory';
import {
  isResolved,
  qualitiesWithoutDefinition,
  resolveChordDefinition,
} from '@/lib/performance/theory';
import { CHORD_CATALOG, getDefinitionById } from '@/lib/theory/definitions';

function definition(id: string) {
  const found = getDefinitionById(id);
  if (!found) throw new Error(`catalog is missing ${id}`);
  return found;
}

function resolve(id: string) {
  const result = resolveChordDefinition(definition(id));
  if (!isResolved(result)) throw new Error(`${id} did not resolve: ${result.reason}`);
  return result;
}

describe('catalog to theory correspondence', () => {
  const results = CHORD_CATALOG.map((def) => resolveChordDefinition(def));
  const resolved = results.filter(isResolved);
  const unresolved = results.filter((result) => !isResolved(result));

  it('measures the gap between the shipped catalog and the theory database', () => {
    expect({
      definitions: CHORD_CATALOG.length,
      resolved: resolved.length,
      unresolved: unresolved.map((result) => result.symbol),
      qualitiesWithNoBareDefinition: qualitiesWithoutDefinition(CHORD_CATALOG),
    }).toEqual({
      definitions: 48,
      resolved: 47,
      // sus2 has no counterpart: the book covers sus4 and does not treat sus2 as a quality.
      unresolved: ['sus2'],
      // Both are theory qualities the catalog never ships on their own. `11` is a
      // suspended dominant *with* a 9th, so `7sus4` is reachable only as a compound.
      qualitiesWithNoBareDefinition: ['minMaj7', '7sus4'],
    });
  });

  it('explains the one definition it cannot express', () => {
    const [sus2] = unresolved;
    expect(sus2).toEqual({
      definitionId: 'sus2',
      symbol: 'sus2',
      catalogQuality: 'suspended',
      pitchClasses: [0, 2, 7],
      reason: 'NO_CORE_QUALITY_MATCHES',
      rejectedCores: [],
    });
  });

  it('accounts for every pitch class of every resolved definition', () => {
    // A resolution that quietly dropped a pitch would authorise the wrong tensions.
    for (const def of CHORD_CATALOG) {
      const result = resolveChordDefinition(def);
      if (!isResolved(result)) continue;
      const expected = [...new Set(def.intervals.map((i) => ((i % 12) + 12) % 12))].sort(
        (a, b) => a - b,
      );
      const covered = [
        ...new Set([
          ...result.corePitchClasses,
          ...result.tensions.map((tension) => TENSION_TO_SEMITONE[tension]),
        ]),
      ].sort((a, b) => a - b);
      expect({ symbol: result.symbol, covered }).toEqual({
        symbol: result.symbol,
        covered: expected,
      });
    }
  });

  it('never invents a pitch the definition does not contain', () => {
    for (const def of CHORD_CATALOG) {
      const result = resolveChordDefinition(def);
      if (!isResolved(result)) continue;
      const present = new Set(def.intervals.map((i) => ((i % 12) + 12) % 12));
      const invented = [
        ...result.corePitchClasses,
        ...result.tensions.map((tension) => TENSION_TO_SEMITONE[tension]),
      ].filter((pc) => !present.has(pc));
      expect({ symbol: result.symbol, invented }).toEqual({ symbol: result.symbol, invented: [] });
    }
  });

  it('keeps every guide tone of a resolved seventh chord', () => {
    for (const def of CHORD_CATALOG) {
      const result = resolveChordDefinition(def);
      if (!isResolved(result)) continue;
      const essential = degreePitchClasses(result.formula.essentialDegrees);
      const missing = essential.filter((pc) => !result.corePitchClasses.includes(pc));
      expect({ symbol: result.symbol, missing }).toEqual({ symbol: result.symbol, missing: [] });
    }
  });

  it('only ever omits a degree the book says may be omitted', () => {
    for (const def of CHORD_CATALOG) {
      const result = resolveChordDefinition(def);
      if (!isResolved(result)) continue;
      const omittable = new Set(result.formula.normallyOmittableDegrees);
      const illegal = result.omittedDegrees.filter((degree) => !omittable.has(degree as never));
      expect({ symbol: result.symbol, illegal }).toEqual({ symbol: result.symbol, illegal: [] });
    }
  });

  it('reaches every theory quality except the one with no shipped spelling', () => {
    const reached = new Set(resolved.map((result) => result.quality));
    const unreached = CHORD_QUALITIES.filter((quality) => !reached.has(quality));
    // `7sus4` is reached, through the compound `11`. `minMaj7` is reached by nothing.
    expect(unreached).toEqual(['minMaj7']);
  });
});

describe('core quality decomposition', () => {
  it('reads a plain triad as itself with no tensions', () => {
    expect(resolve('major')).toMatchObject({ quality: 'maj', tensions: [], omittedDegrees: [] });
    expect(resolve('minor')).toMatchObject({ quality: 'min', tensions: [] });
    expect(resolve('dim')).toMatchObject({ quality: 'dim', tensions: [] });
    expect(resolve('aug')).toMatchObject({ quality: 'aug', tensions: [] });
    expect(resolve('sus4')).toMatchObject({ quality: 'sus4', tensions: [] });
  });

  it('reads a compound symbol as a core quality plus tensions', () => {
    expect(resolve('maj9')).toMatchObject({ quality: 'maj7', tensions: ['9'] });
    expect(resolve('dom9')).toMatchObject({ quality: '7', tensions: ['9'] });
    expect(resolve('m9')).toMatchObject({ quality: 'min7', tensions: ['9'] });
    expect(resolve('dom13_b9')).toMatchObject({ quality: '7', tensions: ['b9', '13'] });
    expect(resolve('m7b5_b9')).toMatchObject({ quality: 'min7b5', tensions: ['b9'] });
  });

  it('prefers the sixth over the add when both fit, because 6/9 is a sixth chord', () => {
    // {0,2,4,7,9} is maj6 + 9 and add9 + 13 alike; only the ranking separates them.
    expect(resolve('six_nine')).toMatchObject({ quality: 'maj6', tensions: ['9'] });
    expect(resolve('m6_nine')).toMatchObject({ quality: 'min6', tensions: ['9'] });
  });

  it('reads add9 as its own quality rather than a triad plus a tension', () => {
    // The book makes the 9th essential to add9, and a tension is by definition optional.
    expect(resolve('add9')).toMatchObject({ quality: 'add9', tensions: [] });
    expect(resolve('m_add9')).toMatchObject({ quality: 'minAdd9', tensions: [] });
    expect(CHORD_FORMULAS.add9.essentialDegrees).toContain('2');
  });

  it('reads the shipped 11 chord as a suspended dominant, which is how it is spelled', () => {
    // `11` ships as [0,5,7,10,14] — a 4th and no 3rd.
    expect(resolve('dom11')).toMatchObject({ quality: '7sus4', tensions: ['9'] });
  });

  it('resolves a dominant that already dropped its fifth', () => {
    // 7alt ships without a 5th, which the book permits, so it is still a dominant 7th.
    expect(resolve('dom7alt')).toMatchObject({
      quality: '7',
      omittedDegrees: ['5'],
      tensions: ['b9', '#9', '#11', 'b13'],
    });
  });

  it('respects the catalog quality when pitch content alone is ambiguous', () => {
    // m(add11) and sus4(#9) are the same pitch classes; the catalog says which is meant.
    expect(resolve('m_add11')).toMatchObject({ quality: 'min', tensions: ['11'] });
  });

  it('keeps an altered fifth in the core instead of demoting it to a tension', () => {
    for (const id of ['m7b5', 'dim7', 'dim']) {
      const result = resolve(id);
      expect({ id, retained: result.formula.alteredFifthMustBeRetained }).toEqual({
        id,
        retained: true,
      });
      expect({ id, tensions: result.tensions }).toEqual({ id, tensions: [] });
    }
  });

  it('surfaces the legacy 11th spellings the theory database calls avoid notes', () => {
    // Recorded, not judged: `maj11` names an 11th over a major 3rd, which the book's
    // Imaj7 table lists as an avoid note. Whether that matters is a later question.
    expect(resolve('maj11')).toMatchObject({ quality: 'maj7', tensions: ['9', '11'] });
    expect(resolve('m7b5_11')).toMatchObject({ quality: 'min7b5', tensions: ['11'] });
  });
});
