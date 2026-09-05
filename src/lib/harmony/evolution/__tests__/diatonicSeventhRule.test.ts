import { diatonicSevenths } from '@/data/music';
import { getDefinitionById } from '@/lib/theory/definitions';
import type { KeyMode, MajorKey } from '@/types';

import { chordCatalogEvolutionProvider } from '../providers/chordCatalogEvolutionProvider';
import { diatonicSeventhRule } from '../rules/diatonicSeventhRule';
import { ALL_TONAL_CONTEXTS, evolutionContext, triadChord } from '../testing/phase1Progressions';
import type { EvolutionChord } from '../types';

const dependencies = { theory: chordCatalogEvolutionProvider };

function generatedAfter(chord: EvolutionChord, tonic: MajorKey = 'C', mode: KeyMode = 'major') {
  const context = evolutionContext([chord], {
    tonic,
    mode,
    scope: { kind: 'chord', index: 0 },
  });
  const applications = diatonicSeventhRule.generate(context, 0, dependencies);
  return applications[0]?.change.kind === 'replace' ? applications[0].change.after : undefined;
}

describe('diatonicSeventhRule', () => {
  it('converts all 168 major/minor diatonic triads through existing mode tables', () => {
    for (const { tonic, mode } of ALL_TONAL_CONTEXTS) {
      const expected = diatonicSevenths(tonic, mode);
      for (let degree = 0; degree < 7; degree += 1) {
        const after = generatedAfter(triadChord(tonic, mode, degree), tonic, mode);
        expect(after?.symbol.suffix).toBe(expected[degree]?.suffix);
        expect(after?.symbol.definitionId).toBe(expected[degree]?.definitionId);
        expect(after?.chordId).toBe(expected[degree]?.id);
      }
    }
  });

  it('maps major vii diminished to the half-diminished seventh definition', () => {
    expect(generatedAfter(triadChord('C', 'major', 6))?.symbol.suffix).toBe('m7♭5');
  });

  it('maps natural-minor ii diminished to the half-diminished seventh definition', () => {
    expect(generatedAfter(triadChord('A', 'minor', 1), 'A', 'minor')?.symbol.suffix).toBe('m7♭5');
  });

  it('reports major and minor support explicitly', () => {
    expect(diatonicSeventhRule.modeSupport).toEqual({
      major: 'SUPPORTED',
      minor: 'SUPPORTED',
    });
  });

  it('returns an eligible support result for a matching diatonic triad', () => {
    const context = evolutionContext([triadChord('C', 'major', 0)], {
      scope: { kind: 'chord', index: 0 },
    });
    expect(diatonicSeventhRule.support(context, 0, dependencies)).toEqual({
      status: 'SUPPORTED',
      eligible: true,
      reason: 'ELIGIBLE',
    });
  });

  it('returns no change for an existing seventh chord', () => {
    const seventh = diatonicSevenths('C', 'major')[0]!;
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: {
        rootOffset: seventh.rootOffset,
        suffix: seventh.suffix,
        definitionId: seventh.definitionId,
      },
    };
    expect(generatedAfter(chord)).toBeUndefined();
  });

  it.each(['9', 'sus2', 'sus4', 'add9', '6', 'aug'])(
    'fails closed for non-triad suffix %s',
    (suffix) => {
      const chord: EvolutionChord = {
        ...triadChord('C', 'major', 0),
        symbol: { rootOffset: 0, suffix },
      };
      expect(generatedAfter(chord)).toBeUndefined();
    },
  );

  it('does not convert a diminished chord on a non-diminished diatonic degree', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: { rootOffset: 0, suffix: 'dim', definitionId: 'dim' },
    };
    expect(generatedAfter(chord)).toBeUndefined();
  });

  it('does not convert a chromatic major or minor triad', () => {
    for (const suffix of ['', 'm']) {
      const chord: EvolutionChord = {
        ...triadChord('C', 'major', 0),
        symbol: { rootOffset: 1, suffix },
      };
      expect(generatedAfter(chord)).toBeUndefined();
    }
  });

  it('does not infer a local key from a secondary dominant', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 2),
      symbol: { rootOffset: 4, suffix: '7', definitionId: '7' },
    };
    expect(generatedAfter(chord)).toBeUndefined();
  });

  it('fails closed for an unknown suffix', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: { rootOffset: 0, suffix: 'not-a-chord' },
    };
    expect(generatedAfter(chord)).toBeUndefined();
  });

  it('fails closed when suffix and definition id disagree', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: { rootOffset: 0, suffix: '', definitionId: 'minor' },
    };
    expect(generatedAfter(chord)).toBeUndefined();
  });

  it('accepts a legacy triad with no definition id when its catalog symbol is exact', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: { rootOffset: 0, suffix: '' },
    };
    expect(generatedAfter(chord)?.symbol.definitionId).toBe('maj7');
  });

  it('uses session tonic and mode when no explicit local context exists', () => {
    const aMinorSecondDegree = triadChord('A', 'minor', 1);
    expect(generatedAfter(aMinorSecondDegree, 'C', 'major')).toBeUndefined();
  });

  it('uses a deliberately marked explicit local harmonic context', () => {
    const chord = triadChord('A', 'minor', 1, {
      localHarmonicContext: {
        kind: 'EXPLICIT_LOCAL',
        tonic: 'A',
        mode: 'minor',
      },
    });
    expect(generatedAfter(chord, 'C', 'major')?.symbol.suffix).toBe('m7♭5');
  });

  it('preserves root, slash bass, spelling, duration, identity and voicing position', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0, { eventId: 'stable-event', durationBeats: 2 }),
      symbol: {
        rootOffset: 0,
        suffix: '',
        definitionId: 'major',
        rootSpelling: { degreeIndex: 0, alteration: 0 },
        bassOffset: 4,
      },
      voicingPosition: 'first',
    };
    const after = generatedAfter(chord)!;
    expect(after).toMatchObject({
      eventId: 'stable-event',
      durationBeats: 2,
      voicingPosition: 'first',
      symbol: {
        rootOffset: 0,
        rootSpelling: { degreeIndex: 0, alteration: 0 },
        bassOffset: 4,
      },
    });
  });

  it('always resolves the generated target back to CHORD_CATALOG', () => {
    for (const { tonic, mode } of ALL_TONAL_CONTEXTS) {
      for (let degree = 0; degree < 7; degree += 1) {
        const after = generatedAfter(triadChord(tonic, mode, degree), tonic, mode)!;
        const definition = getDefinitionById(after.symbol.definitionId!);
        expect(definition).toBeDefined();
        expect(definition?.symbol).toBe(after.symbol.suffix);
        expect(definition?.intervals).toEqual(
          getDefinitionById(diatonicSevenths(tonic, mode)[degree]!.definitionId!)?.intervals,
        );
      }
    }
  });

  it('returns target-out-of-range without throwing', () => {
    const context = evolutionContext([triadChord('C', 'major', 0)], {
      scope: { kind: 'chord', index: 0 },
    });
    expect(diatonicSeventhRule.support(context, 9, dependencies)).toEqual({
      status: 'SUPPORTED',
      eligible: false,
      reason: 'TARGET_OUT_OF_RANGE',
    });
    expect(diatonicSeventhRule.generate(context, 9, dependencies)).toEqual([]);
  });
});
