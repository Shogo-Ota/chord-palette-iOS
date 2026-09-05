import { diatonicSevenths } from '@/data/music';

import { MAX_EVOLUTION_CANDIDATES, generateEvolutionCandidates } from '../generateCandidates';
import {
  MAJOR_PROGRESSION_DEGREES_20,
  evolutionContext,
  triadChord,
  triadProgression,
} from '../testing/phase1Progressions';
import type { EvolutionChord, EvolutionContext } from '../types';

function onlyCandidate(context: EvolutionContext) {
  const candidates = generateEvolutionCandidates(context);
  expect(candidates).toHaveLength(1);
  return candidates[0]!;
}

describe('seventhRecipe', () => {
  it('changes only the selected chord in chord scope', () => {
    const progression = triadProgression('C', 'major', [0, 1, 4]);
    const candidate = onlyCandidate(
      evolutionContext(progression, { scope: { kind: 'chord', index: 1 } }),
    );
    expect(candidate.after.map((chord) => chord.symbol.suffix)).toEqual(['', 'm7', '']);
    expect(candidate.changes).toHaveLength(1);
    expect(candidate.changes[0]).toMatchObject({ kind: 'replace', index: 1 });
  });

  it('converts every eligible triad in progression scope into one candidate', () => {
    const progression = triadProgression('C', 'major', [0, 1, 4, 6]);
    const candidate = onlyCandidate(evolutionContext(progression));
    expect(candidate.after.map((chord) => chord.symbol.suffix)).toEqual([
      'maj7',
      'm7',
      '7',
      'm7♭5',
    ]);
    expect(candidate.changes).toHaveLength(4);
  });

  it('never creates a Cartesian product', () => {
    const progression = triadProgression('C', 'major', [0, 1, 2, 3, 4, 5, 6]);
    const candidates = generateEvolutionCandidates(evolutionContext(progression));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.changes).toHaveLength(7);
  });

  it('enforces the shared maximum candidate boundary', () => {
    expect(MAX_EVOLUTION_CANDIDATES).toBe(3);
    const candidates = generateEvolutionCandidates(
      evolutionContext(triadProgression('C', 'major', [0, 4])),
    );
    expect(candidates.length).toBeLessThanOrEqual(MAX_EVOLUTION_CANDIDATES);
  });

  it('returns no candidate for an invalid selected index', () => {
    const context = evolutionContext(triadProgression('C', 'major', [0]), {
      scope: { kind: 'chord', index: 8 },
    });
    expect(generateEvolutionCandidates(context)).toEqual([]);
  });

  it('returns no candidate when the progression contains no eligible triad', () => {
    const chord: EvolutionChord = {
      ...triadChord('C', 'major', 0),
      symbol: { rootOffset: 0, suffix: 'maj7', definitionId: 'maj7' },
    };
    expect(generateEvolutionCandidates(evolutionContext([chord]))).toEqual([]);
  });

  it('preserves durations 1, 2 and 4 and keeps total beats unchanged', () => {
    const progression: EvolutionChord[] = [
      triadChord('C', 'major', 0, { eventId: 'a', durationBeats: 1 }),
      triadChord('C', 'major', 1, { eventId: 'b', durationBeats: 2 }),
      triadChord('C', 'major', 4, { eventId: 'c', durationBeats: 4 }),
    ];
    const candidate = onlyCandidate(evolutionContext(progression));
    expect(candidate.after.map((chord) => chord.durationBeats)).toEqual([1, 2, 4]);
    expect(candidate.after.reduce((sum, chord) => sum + chord.durationBeats, 0)).toBe(
      progression.reduce((sum, chord) => sum + chord.durationBeats, 0),
    );
  });

  it('preserves event identity, ordering, function and optional chord metadata', () => {
    const progression: EvolutionChord[] = [
      {
        ...triadChord('C', 'major', 0, { eventId: 'first' }),
        symbol: {
          rootOffset: 0,
          suffix: '',
          definitionId: 'major',
          rootSpelling: { degreeIndex: 0, alteration: 0 },
          bassOffset: 4,
        },
        voicingPosition: 'first',
      },
      triadChord('C', 'major', 4, { eventId: 'second' }),
    ];
    const candidate = onlyCandidate(evolutionContext(progression));
    expect(candidate.after.map((chord) => chord.eventId)).toEqual(['first', 'second']);
    expect(candidate.after[0]).toMatchObject({
      function: progression[0]!.function,
      voicingPosition: 'first',
      symbol: {
        rootOffset: 0,
        rootSpelling: { degreeIndex: 0, alteration: 0 },
        bassOffset: 4,
      },
    });
  });

  it('supports mixed modes only through an explicitly marked local context', () => {
    const sessionMajor = triadChord('C', 'major', 0, { eventId: 'session-major' });
    const explicitMinor = triadChord('A', 'minor', 1, {
      eventId: 'explicit-minor',
      localHarmonicContext: {
        kind: 'EXPLICIT_LOCAL',
        tonic: 'A',
        mode: 'minor',
      },
    });
    const candidate = onlyCandidate(evolutionContext([sessionMajor, explicitMinor]));

    expect(candidate.after.map((chord) => chord.symbol.suffix)).toEqual(['maj7', 'm7♭5']);
    expect(candidate.after[1]?.localHarmonicContext).toEqual({
      kind: 'EXPLICIT_LOCAL',
      tonic: 'A',
      mode: 'minor',
    });
  });

  it('does not backfill an untouched legacy chord definition id', () => {
    const legacySeventh: EvolutionChord = {
      ...triadChord('C', 'major', 1, { eventId: 'legacy' }),
      symbol: { rootOffset: 2, suffix: 'm7' },
    };
    const candidate = onlyCandidate(evolutionContext([triadChord('C', 'major', 0), legacySeventh]));
    expect(candidate.after[1]?.symbol).toEqual({ rootOffset: 2, suffix: 'm7' });
  });

  it('marks L1 as free, rule-based, design-target and unevaluated', () => {
    const candidate = onlyCandidate(evolutionContext(triadProgression('C', 'major', [0])));
    expect(candidate).toMatchObject({
      level: 'seventh',
      technique: 'add_seventh',
      requiredTier: 'FREE',
      generationMethod: 'RULE_BASED',
      evidence: 'DESIGN_TARGET',
      theoryLabel: 'DIATONIC_SEVENTH',
      rationaleCode: 'DIATONIC_TRIAD_TO_SEVENTH',
      score: { status: 'UNEVALUATED' },
    });
  });

  it('keeps theory provenance separate from evidence level', () => {
    const candidate = onlyCandidate(evolutionContext(triadProgression('C', 'major', [0])));
    expect(candidate.evidence).toBe('DESIGN_TARGET');
    expect(candidate.theorySources.length).toBeGreaterThan(0);
    expect(candidate.theorySources.every((source) => source.kind.startsWith('BOOK_'))).toBe(true);
  });

  it('does not evaluate recipes for another requested level', () => {
    const context: EvolutionContext = {
      ...evolutionContext(triadProgression('C', 'major', [0])),
      level: 'tension',
    };
    expect(generateEvolutionCandidates(context)).toEqual([]);
  });

  it.each(MAJOR_PROGRESSION_DEGREES_20.map((degrees, index) => [index + 1, degrees] as const))(
    'returns a valid L1 candidate for representative progression %i',
    (_caseNumber, degrees) => {
      const progression = triadProgression('C', 'major', degrees);
      const candidate = onlyCandidate(evolutionContext(progression));
      expect(candidate.after).toHaveLength(progression.length);
      candidate.after.forEach((chord, index) => {
        const degree = degrees[index]!;
        expect(chord.symbol.suffix).toBe(diatonicSevenths('C', 'major')[degree]?.suffix);
      });
    },
  );
});
