import { generateEvolutionCandidates } from '../generateCandidates';
import { l2Context, seventhChord, seventhProgression } from '../testing/l2Progressions';
import type { EvolutionChord } from '../types';

describe('l2Recipe', () => {
  it('uses fixed T0, S0, T1 interleave for the first three available candidates', () => {
    const candidates = generateEvolutionCandidates(
      l2Context(seventhProgression('C', 'major', [0, 3, 4])),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.technique)).toEqual([
      'add_tension',
      'slash_chord',
      'add_tension',
    ]);
  });

  it('uses rank lanes instead of a Cartesian product', () => {
    const progression = seventhProgression('C', 'major', [0, 1, 3, 4, 5, 6]);
    const candidates = generateEvolutionCandidates(l2Context(progression));
    expect(candidates.length).toBeLessThanOrEqual(3);
    const tensionCandidates = candidates.filter(
      (candidate) => candidate.technique === 'add_tension',
    );
    expect(tensionCandidates.length).toBeLessThanOrEqual(3);
    expect(
      tensionCandidates.every((candidate) => candidate.changes.length <= progression.length),
    ).toBe(true);
  });

  it('changes one chord per slash candidate and leaves order and duration intact', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4, 0]);
    const candidates = generateEvolutionCandidates(l2Context(progression));
    for (const candidate of candidates.filter((item) => item.technique === 'slash_chord')) {
      expect(candidate.changes).toHaveLength(1);
      expect(candidate.after.map((chord) => chord.eventId)).toEqual(
        progression.map((chord) => chord.eventId),
      );
      expect(candidate.after.map((chord) => chord.durationBeats)).toEqual(
        progression.map((chord) => chord.durationBeats),
      );
    }
  });

  it('changes only the selected chord in chord scope', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4]);
    const candidates = generateEvolutionCandidates(
      l2Context(progression, {
        scope: { kind: 'chord', index: 1 },
      }),
    );
    for (const candidate of candidates) {
      expect(candidate.changes).toHaveLength(1);
      expect(candidate.changes[0]).toMatchObject({
        kind: 'replace',
        index: 1,
      });
    }
  });

  it('returns zero candidates for ineligible input and invalid scope', () => {
    const tension: EvolutionChord = {
      ...seventhChord('C', 'major', 0),
      symbol: {
        rootOffset: 0,
        suffix: 'maj9',
        definitionId: 'maj9',
      },
    };
    expect(generateEvolutionCandidates(l2Context([tension]))).toEqual([]);
    expect(
      generateEvolutionCandidates(
        l2Context(seventhProgression('C', 'major', [0]), {
          scope: { kind: 'chord', index: 9 },
        }),
      ),
    ).toEqual([]);
  });

  it('marks every L2 result PRO, rule-based, design-target and unevaluated', () => {
    const candidates = generateEvolutionCandidates(
      l2Context(seventhProgression('C', 'major', [0, 3, 4])),
    );
    for (const candidate of candidates) {
      expect(candidate).toMatchObject({
        level: 'tension',
        requiredTier: 'PRO',
        score: { status: 'UNEVALUATED' },
        generationMethod: 'RULE_BASED',
        evidence: 'DESIGN_TARGET',
      });
      expect(candidate.theorySources.length).toBeGreaterThan(0);
      expect(candidate.theorySources.some((source) => source.kind === 'APP_POLICY_PROPOSED')).toBe(
        true,
      );
    }
  });

  it('keeps every candidate id unique and derived from stable inputs', () => {
    const context = l2Context(seventhProgression('C', 'major', [0, 3, 4]));
    const ids = generateEvolutionCandidates(context).map((candidate) => candidate.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.includes('C:major'))).toBe(true);
    expect(generateEvolutionCandidates(context).map((candidate) => candidate.id)).toEqual(ids);
  });

  it('does not evaluate L2 recipes for the seventh level', () => {
    const context = {
      ...l2Context(seventhProgression('C', 'major', [0, 3, 4])),
      level: 'seventh' as const,
    };
    expect(generateEvolutionCandidates(context)).toEqual([]);
  });
});
