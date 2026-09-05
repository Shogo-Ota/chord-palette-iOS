import { generateEvolutionCandidates } from '../generateCandidates';
import {
  ALL_TONAL_CONTEXTS,
  evolutionContext,
  triadProgression,
} from '../testing/phase1Progressions';
import type { EvolutionContext } from '../types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

describe('evolution generation purity', () => {
  it('returns byte-for-byte equivalent candidates for the same input 100 times', () => {
    const context = evolutionContext(triadProgression('C', 'major', [0, 4, 5, 3]));
    const expected = JSON.stringify(generateEvolutionCandidates(context));
    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(JSON.stringify(generateEvolutionCandidates(context))).toBe(expected);
    }
  });

  it('keeps candidate id and order stable in all 24 tonic/mode contexts', () => {
    for (const { tonic, mode } of ALL_TONAL_CONTEXTS) {
      const context = evolutionContext(triadProgression(tonic, mode, [0, 1, 4, 6]), {
        tonic,
        mode,
      });
      const first = generateEvolutionCandidates(context);
      const second = generateEvolutionCandidates(context);
      expect(second.map((candidate) => candidate.id)).toEqual(
        first.map((candidate) => candidate.id),
      );
      expect(second).toEqual(first);
    }
  });

  it('has no time or random-dependent data in the candidate', () => {
    const candidate = generateEvolutionCandidates(
      evolutionContext(triadProgression('C', 'major', [0])),
    )[0]!;
    expect(JSON.stringify(candidate)).not.toMatch(/timestamp|createdAt|random|seed/i);
    expect(candidate.id).toBe('evolution:seventh:C:major:progression:0:maj7');
  });

  it('does not mutate EvolutionContext or the original progression after generation', () => {
    const progression = triadProgression('A', 'minor', [0, 1, 4, 6]);
    const context: EvolutionContext = evolutionContext(progression, {
      tonic: 'A',
      mode: 'minor',
    });
    const snapshot = JSON.stringify(context);
    deepFreeze(context);

    const candidates = generateEvolutionCandidates(context);

    expect(JSON.stringify(context)).toBe(snapshot);
    expect(context.progression).toBe(progression);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.before[0]).not.toBe(progression[0]);
    expect(candidates[0]?.after[0]).not.toBe(progression[0]);
    expect(candidates[0]?.before[0]?.symbol).not.toBe(progression[0]?.symbol);
    expect(candidates[0]?.after[0]?.symbol).not.toBe(progression[0]?.symbol);
  });
});
