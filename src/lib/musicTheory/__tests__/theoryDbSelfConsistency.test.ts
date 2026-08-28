/**
 * Does the theory database contradict itself?
 *
 * A theory table is only useful if its own claims hang together: a formula cannot call a
 * degree essential without listing it, a tension cannot be available and avoided at once,
 * and a diatonic degree cannot sit outside the scale it is supposed to belong to. None of
 * that is checkable by reading; all of it is checkable arithmetically.
 *
 * These are structural checks, not musical opinions. Nothing here asserts that the book is
 * right — only that we transcribed it without breaking it.
 */

import {
  ADD_RULES,
  AVOID_NOTE_HEURISTIC,
  CHORD_FORMULAS,
  CHORD_PALETTE_HARMONY_POLICY,
  CHORD_PALETTE_THEORY_DB,
  CHORD_QUALITIES,
  DEGREE_TO_SEMITONE,
  DOMINANT_SCALE_OPTIONS,
  DOMINANT_TENSION_UNIVERSE,
  MAJOR_DIATONIC,
  MAJOR_DIATONIC_TENSIONS,
  NATURAL_MINOR_DIATONIC,
  NATURAL_MINOR_TENSIONS,
  RELATED_II_RULE,
  SCALE_FORMULAS,
  SECONDARY_DOMINANTS_MAJOR,
  SUS_RULES,
  TENSION_AS_DEGREE,
  TENSION_TOKENS,
  TENSION_TO_SEMITONE,
  VOICING_THEORY,
  degreePitchClasses,
  dominantScaleRootPc,
  equivalentDiminishedRoots,
  getSubstituteDominantRoot,
  isBookSourced,
  isScaleId,
  relatedIiRoot,
  type ChordFormula,
  type DiatonicDegreeRule,
  type ScaleId,
  type SourceRef,
  type TensionRule,
} from '@/lib/musicTheory';

const ALL_TENSION_RULES: readonly TensionRule[] = [
  ...MAJOR_DIATONIC_TENSIONS,
  ...NATURAL_MINOR_TENSIONS,
];

function formulaEntries(): [string, ChordFormula][] {
  return Object.entries(CHORD_FORMULAS);
}

describe('degree vocabulary', () => {
  it('maps every degree into one octave', () => {
    for (const [degree, semitone] of Object.entries(DEGREE_TO_SEMITONE)) {
      expect({ degree, inRange: semitone >= 0 && semitone <= 11 }).toEqual({
        degree,
        inRange: true,
      });
    }
  });

  it('derives tension semitones from the degree they are enharmonic to', () => {
    for (const tension of TENSION_TOKENS) {
      expect({ tension, semitone: TENSION_TO_SEMITONE[tension] }).toEqual({
        tension,
        semitone: DEGREE_TO_SEMITONE[TENSION_AS_DEGREE[tension]],
      });
    }
  });

  it('keeps every tension distinct in pitch class', () => {
    const semitones = TENSION_TOKENS.map((tension) => TENSION_TO_SEMITONE[tension]);
    expect(new Set(semitones).size).toBe(TENSION_TOKENS.length);
  });
});

describe('chord formulas', () => {
  it('lists every essential and omittable degree among its own degrees', () => {
    for (const [quality, formula] of formulaEntries()) {
      const degrees = new Set(formula.degrees);
      const strays = [...formula.essentialDegrees, ...formula.normallyOmittableDegrees].filter(
        (degree) => !degrees.has(degree),
      );
      expect({ quality, strays }).toEqual({ quality, strays: [] });
    }
  });

  it('never calls the same degree both essential and omittable', () => {
    for (const [quality, formula] of formulaEntries()) {
      const essential = new Set(formula.essentialDegrees);
      const both = formula.normallyOmittableDegrees.filter((degree) => essential.has(degree));
      expect({ quality, both }).toEqual({ quality, both: [] });
    }
  });

  it('leaves no degree unclassified beyond the root', () => {
    // Every degree should be essential, omittable, or the root that a bass may supply.
    for (const [quality, formula] of formulaEntries()) {
      const classified = new Set([
        ...formula.essentialDegrees,
        ...formula.normallyOmittableDegrees,
        'R',
      ]);
      const unclassified = formula.degrees.filter((degree) => !classified.has(degree));
      expect({ quality, unclassified }).toEqual({ quality, unclassified: [] });
    }
  });

  it('spells no two degrees on the same pitch class', () => {
    for (const [quality, formula] of formulaEntries()) {
      expect({ quality, distinct: degreePitchClasses(formula.degrees).length }).toEqual({
        quality,
        distinct: formula.degrees.length,
      });
    }
  });

  it('protects an altered fifth instead of letting it be dropped', () => {
    for (const [quality, formula] of formulaEntries()) {
      if (!formula.alteredFifthMustBeRetained) continue;
      const hasAlteredFifth = formula.degrees.some((degree) => degree === 'b5' || degree === '#5');
      const perfectFifthOmittable = formula.normallyOmittableDegrees.includes('5');
      expect({ quality, hasAlteredFifth, perfectFifthOmittable }).toEqual({
        quality,
        hasAlteredFifth: true,
        perfectFifthOmittable: false,
      });
    }
  });

  it('marks a chord with an altered fifth as retaining it', () => {
    for (const [quality, formula] of formulaEntries()) {
      const hasAlteredFifth = formula.degrees.some((degree) => degree === 'b5' || degree === '#5');
      if (!hasAlteredFifth) continue;
      expect({ quality, retained: formula.alteredFifthMustBeRetained === true }).toEqual({
        quality,
        retained: true,
      });
    }
  });

  it('treats the perfect fifth as omittable wherever one is present', () => {
    // The book's fifth-omission permission; the altered-fifth qualities have no perfect 5th.
    for (const [quality, formula] of formulaEntries()) {
      if (!formula.degrees.includes('5')) continue;
      expect({ quality, omittable: formula.normallyOmittableDegrees.includes('5') }).toEqual({
        quality,
        omittable: true,
      });
    }
  });

  it('keeps both guide tones essential in every seventh chord', () => {
    const sevenths = ['maj7', '7', 'min7', 'minMaj7', 'min7b5', '7sus4'] as const;
    for (const quality of sevenths) {
      const formula = CHORD_FORMULAS[quality];
      const seventh = formula.degrees.find((degree) => degree.endsWith('7'));
      const characteristic = formula.degrees.find(
        (degree) => degree === '3' || degree === 'b3' || degree === '4',
      );
      expect({
        quality,
        seventhEssential: seventh != null && formula.essentialDegrees.includes(seventh),
        characteristicEssential:
          characteristic != null && formula.essentialDegrees.includes(characteristic),
      }).toEqual({ quality, seventhEssential: true, characteristicEssential: true });
    }
  });

  it('gives add9 no seventh, which is what the rule says defines it', () => {
    expect(ADD_RULES.add9HasNoSeventhByDefinition).toBe(true);
    for (const quality of ['add9', 'minAdd9'] as const) {
      const hasSeventh = CHORD_FORMULAS[quality].degrees.some((degree) => degree.endsWith('7'));
      expect({ quality, hasSeventh }).toEqual({ quality, hasSeventh: false });
    }
  });

  it('replaces the third with the fourth in every sus quality', () => {
    expect(SUS_RULES.allowThirdSimultaneously).toBe(false);
    for (const quality of ['sus4', '7sus4'] as const) {
      const degrees = CHORD_FORMULAS[quality].degrees;
      expect({
        quality,
        hasFourth: degrees.includes('4'),
        hasThird: degrees.includes('3') || degrees.includes('b3'),
      }).toEqual({ quality, hasFourth: true, hasThird: false });
    }
  });

  it('stacks the diminished seventh in equal minor thirds', () => {
    const pcs = degreePitchClasses(CHORD_FORMULAS.dim7.degrees);
    expect(pcs).toEqual([0, 3, 6, 9]);
    expect(equivalentDiminishedRoots(0)).toEqual(pcs);
  });
});

describe('scales', () => {
  it('spells each scale in ascending, distinct pitch classes', () => {
    for (const [id, scale] of Object.entries(SCALE_FORMULAS)) {
      const pcs = scale.degrees.map((degree) => DEGREE_TO_SEMITONE[degree]);
      expect({ id, ascending: pcs, sorted: [...pcs].sort((a, b) => a - b) }).toEqual({
        id,
        ascending: pcs,
        sorted: pcs,
      });
      expect({ id, distinct: new Set(pcs).size }).toEqual({ id, distinct: pcs.length });
    }
  });

  it('starts every scale on its root', () => {
    for (const [id, scale] of Object.entries(SCALE_FORMULAS)) {
      expect({ id, first: scale.degrees[0] }).toEqual({ id, first: 'R' });
    }
  });

  it('holds seven notes except the whole tone scale, which holds six', () => {
    for (const [id, scale] of Object.entries(SCALE_FORMULAS)) {
      expect({ id, size: scale.degrees.length }).toEqual({
        id,
        size: id === 'wholeTone' ? 6 : 7,
      });
    }
  });
});

describe('diatonic tables', () => {
  const cases: [string, readonly DiatonicDegreeRule[], ScaleId][] = [
    ['major', MAJOR_DIATONIC, 'ionian'],
    ['natural minor', NATURAL_MINOR_DIATONIC, 'aeolian'],
  ];

  it.each(cases)(
    'places every %s degree on a step of its parent scale',
    (_label, table, parent) => {
      const parentPcs = new Set(degreePitchClasses(SCALE_FORMULAS[parent].degrees));
      for (const rule of table) {
        expect({ degree: rule.degree, onScale: parentPcs.has(rule.rootOffset) }).toEqual({
          degree: rule.degree,
          onScale: true,
        });
      }
    },
  );

  it.each(cases)('covers every step of the %s scale exactly once', (_label, table, parent) => {
    const offsets = table.map((rule) => rule.rootOffset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(
      degreePitchClasses(SCALE_FORMULAS[parent].degrees),
    );
  });

  it.each(cases)('resolves every %s quality and chord scale', (_label, table) => {
    for (const rule of table) {
      expect({
        degree: rule.degree,
        triad: CHORD_QUALITIES.includes(rule.triad),
        seventh: CHORD_QUALITIES.includes(rule.seventh),
        scale: isScaleId(rule.chordScale),
      }).toEqual({ degree: rule.degree, triad: true, seventh: true, scale: true });
    }
  });

  it.each(cases)('builds every %s seventh on top of its own triad', (_label, table) => {
    for (const rule of table) {
      const triad = new Set(degreePitchClasses(CHORD_FORMULAS[rule.triad].degrees));
      const seventh = degreePitchClasses(CHORD_FORMULAS[rule.seventh].degrees);
      const dropped = [...triad].filter((pc) => !seventh.includes(pc));
      expect({ degree: rule.degree, dropped }).toEqual({ degree: rule.degree, dropped: [] });
    }
  });

  it('roots the diatonic chord on the scale degree it sits over', () => {
    for (const rule of MAJOR_DIATONIC) {
      const pcs = degreePitchClasses(CHORD_FORMULAS[rule.seventh].degrees).map(
        (pc) => (pc + rule.rootOffset) % 12,
      );
      const ionian = new Set(degreePitchClasses(SCALE_FORMULAS.ionian.degrees));
      const outside = pcs.filter((pc) => !ionian.has(pc));
      expect({ degree: rule.degree, outside }).toEqual({ degree: rule.degree, outside: [] });
    }
  });
});

describe('tension tables', () => {
  it('never lists a tension as both available and avoided', () => {
    for (const rule of ALL_TENSION_RULES) {
      const available = new Set(rule.available);
      const both = rule.avoid.filter((tension) => available.has(tension));
      expect({ contextId: rule.contextId, both }).toEqual({ contextId: rule.contextId, both: [] });
    }
  });

  it('resolves every chord scale it names', () => {
    for (const rule of ALL_TENSION_RULES) {
      expect({ contextId: rule.contextId, scale: isScaleId(rule.chordScale) }).toEqual({
        contextId: rule.contextId,
        scale: true,
      });
    }
  });

  it('uses a unique context id per table', () => {
    for (const table of [MAJOR_DIATONIC_TENSIONS, NATURAL_MINOR_TENSIONS]) {
      const ids = table.map((rule) => rule.contextId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('draws every available tension from the chord scale it names', () => {
    for (const rule of ALL_TENSION_RULES) {
      const scalePcs = new Set(degreePitchClasses(SCALE_FORMULAS[rule.chordScale].degrees));
      const offScale = rule.available.filter(
        (tension) => !scalePcs.has(TENSION_TO_SEMITONE[tension]),
      );
      expect({ contextId: rule.contextId, offScale }).toEqual({
        contextId: rule.contextId,
        offScale: [],
      });
    }
  });

  it('covers one tension rule per diatonic degree', () => {
    expect(MAJOR_DIATONIC_TENSIONS).toHaveLength(MAJOR_DIATONIC.length);
    expect(NATURAL_MINOR_TENSIONS).toHaveLength(NATURAL_MINOR_DIATONIC.length);
  });

  it('matches each tension rule to the chord scale of its diatonic degree', () => {
    const pairs: [readonly TensionRule[], readonly DiatonicDegreeRule[]][] = [
      [MAJOR_DIATONIC_TENSIONS, MAJOR_DIATONIC],
      [NATURAL_MINOR_TENSIONS, NATURAL_MINOR_DIATONIC],
    ];
    for (const [tensions, diatonic] of pairs) {
      tensions.forEach((rule, index) => {
        expect({ contextId: rule.contextId, scale: rule.chordScale }).toEqual({
          contextId: rule.contextId,
          scale: diatonic[index]!.chordScale,
        });
      });
    }
  });

  it('keeps the dominant basics inside its own candidate universe', () => {
    const potential = new Set(DOMINANT_TENSION_UNIVERSE.potential);
    for (const [label, basics] of [
      ['major', DOMINANT_TENSION_UNIVERSE.basicMajorKey],
      ['minor', DOMINANT_TENSION_UNIVERSE.basicMinorKey],
    ] as const) {
      const outside = basics.filter((tension) => !potential.has(tension));
      expect({ label, outside }).toEqual({ label, outside: [] });
    }
  });

  it('refuses to be a hard gate on avoid notes', () => {
    // The book declines this; a consumer may only price it.
    expect(AVOID_NOTE_HEURISTIC.hardGate).toBe(false);
    expect(AVOID_NOTE_HEURISTIC.policyNote.kind).toBe('APP_POLICY_PROPOSED');
  });
});

describe('dominant harmony', () => {
  it('resolves every dominant scale option, rooting included', () => {
    for (const option of DOMINANT_SCALE_OPTIONS) {
      const scalePcs = new Set(degreePitchClasses(SCALE_FORMULAS[option.scaleId].degrees));
      // Tensions are named relative to the chord root, so shift the scale to that root.
      const shift = option.rootedOn === 'perfectFifthBelow' ? 5 : 0;
      const fromChordRoot = new Set([...scalePcs].map((pc) => (pc + shift) % 12));
      const offScale = option.tensions.filter(
        (tension) => !fromChordRoot.has(TENSION_TO_SEMITONE[tension]),
      );
      expect({ scaleId: option.scaleId, offScale }).toEqual({
        scaleId: option.scaleId,
        offScale: [],
      });
    }
  });

  it('roots the minor-key dominant scale a perfect fifth below the chord', () => {
    // G7 in C minor draws on C harmonic minor: C is a fifth below G.
    expect(dominantScaleRootPc(7, 'perfectFifthBelow')).toBe(0);
    expect(dominantScaleRootPc(7, 'chordRoot')).toBe(7);
  });

  it('resolves every secondary dominant down a perfect fifth', () => {
    for (const rule of SECONDARY_DOMINANTS_MAJOR) {
      expect({
        target: rule.targetDegree,
        resolved: (rule.dominantRootOffsetFromKey + 5) % 12,
      }).toEqual({ target: rule.targetDegree, resolved: rule.targetRootOffsetFromKey });
    }
  });

  it('targets a diatonic degree that is not the tonic', () => {
    const diatonic = new Map(MAJOR_DIATONIC.map((rule) => [rule.degree, rule.rootOffset]));
    for (const rule of SECONDARY_DOMINANTS_MAJOR) {
      expect({ target: rule.targetDegree, offset: diatonic.get(rule.targetDegree) }).toEqual({
        target: rule.targetDegree,
        offset: rule.targetRootOffsetFromKey,
      });
    }
    expect(SECONDARY_DOMINANTS_MAJOR.some((rule) => rule.targetDegree === 'I')).toBe(false);
  });

  it('makes the tritone substitute its own inverse', () => {
    for (let pc = 0; pc < 12; pc += 1) {
      expect(getSubstituteDominantRoot(getSubstituteDominantRoot(pc))).toBe(pc);
    }
  });

  it('shares both guide tones between a dominant and its tritone substitute', () => {
    // The 3rd and 7th swap roles, so the pair of pitches is identical.
    const guideTones = (rootPc: number): number[] =>
      [4, 10].map((interval) => (rootPc + interval) % 12).sort((a, b) => a - b);
    for (let pc = 0; pc < 12; pc += 1) {
      expect(guideTones(getSubstituteDominantRoot(pc))).toEqual(guideTones(pc));
    }
  });

  it('puts the related IIm7 a perfect fifth above the dominant', () => {
    expect(relatedIiRoot(7)).toBe(2);
    expect(RELATED_II_RULE.iiQuality).toBe('min7');
    for (let pc = 0; pc < 12; pc += 1) {
      // Its own resolution is a perfect fifth down, which is what makes it a ii-V.
      expect((relatedIiRoot(pc) + 5) % 12).toBe(pc);
    }
  });
});

describe('provenance', () => {
  it('cites a printed page for every book-derived claim', () => {
    const refs: SourceRef[] = [
      ...Object.values(CHORD_FORMULAS).flatMap((formula) => [...formula.source]),
      ...Object.values(SCALE_FORMULAS).flatMap((scale) => [...scale.source]),
      ...ALL_TENSION_RULES.flatMap((rule) => [...rule.source]),
      ...DOMINANT_SCALE_OPTIONS.flatMap((option) => [...option.source]),
      ...SECONDARY_DOMINANTS_MAJOR.flatMap((rule) => [...rule.source]),
    ];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect({ chapter: ref.chapter, book: isBookSourced(ref) }).toEqual({
        chapter: ref.chapter,
        book: true,
      });
      if (!isBookSourced(ref)) continue;
      expect({ chapter: ref.chapter, pages: ref.printedPages.length > 0 }).toEqual({
        chapter: ref.chapter,
        pages: true,
      });
    }
  });

  it('keeps app policy out of the book-derived tables', () => {
    expect(CHORD_PALETTE_HARMONY_POLICY.provenance.kind).toBe('APP_POLICY_PROPOSED');
    expect(isBookSourced(CHORD_PALETTE_HARMONY_POLICY.provenance)).toBe(false);
  });

  it('does not let the guitar string limit escape as a global rule', () => {
    expect(VOICING_THEORY.guitarPhysicalLimit.applyGlobally).toBe(false);
  });
});

describe('aggregate', () => {
  it('exposes every table through one object', () => {
    expect(CHORD_PALETTE_THEORY_DB.version).toBe('0.1.0');
    expect(CHORD_PALETTE_THEORY_DB.chordFormulas).toBe(CHORD_FORMULAS);
    expect(CHORD_PALETTE_THEORY_DB.scales).toBe(SCALE_FORMULAS);
    expect(Object.values(CHORD_PALETTE_THEORY_DB).every((value) => value != null)).toBe(true);
  });

  it('states the app policy collision distances in real semitones, not interval class', () => {
    const { collisionSafety } = CHORD_PALETTE_HARMONY_POLICY;
    expect(collisionSafety.rejectDirectMinorSecondSemitones).toBe(1);
    expect(collisionSafety.rejectDirectMinorNinthSemitones).toBe(13);
    // 13 is not 1: an octave apart is a different verdict, which is the whole point.
    expect(collisionSafety.rejectDirectMinorNinthSemitones % 12).toBe(
      collisionSafety.rejectDirectMinorSecondSemitones,
    );
  });
});
