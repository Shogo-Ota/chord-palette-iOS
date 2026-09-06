import { MAJOR_KEYS } from '@/data/music';

import { generateEvolutionCandidates } from '../../generateCandidates';
import { seventhProgression } from '../../testing/l2Progressions';
import { triadProgression } from '../../testing/phase1Progressions';
import { harmonicEffectForTechnique } from '../ranking/candidateDiversity';
import { rankEvolutionCandidates } from '../ranking/candidateRanker';
import { l3Context } from '../testing/l3Progressions';

const SCORE_COMPONENTS = [
  'resolutionStrength',
  'voiceLeadingCost',
  'bassMovementCost',
  'commonToneScore',
  'harmonicFunctionFit',
  'tensionValidity',
  'complexityDelta',
];

describe('L3 cross-provider ranking', () => {
  it('returns deterministic scored top-three candidates with technique diversity', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 5, 3, 4]));
    const candidates = generateEvolutionCandidates(context);
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map((candidate) => candidate.technique)).size).toBeGreaterThanOrEqual(
      2,
    );
    for (const candidate of candidates) {
      expect(candidate.score.status).toBe('SCORED');
      if (candidate.score.status !== 'SCORED') continue;
      expect(candidate.score.components.map((component) => component.id)).toEqual(SCORE_COMPONENTS);
      expect(Number.isInteger(candidate.score.total)).toBe(true);
    }
    expect(generateEvolutionCandidates(context)).toEqual(candidates);
  });

  it('combines frozen L2 and L3 providers only in the reharm path', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4, 0]);
    const reharm = generateEvolutionCandidates(l3Context(progression));
    expect(reharm.length).toBeLessThanOrEqual(3);
    expect(
      reharm.some((candidate) => ['add_tension', 'slash_chord'].includes(candidate.technique)),
    ).toBe(true);
    expect(
      reharm.some((candidate) =>
        ['secondary_dominant', 'passing_diminished', 'tritone_substitute'].includes(
          candidate.technique,
        ),
      ),
    ).toBe(true);

    const frozenL2 = generateEvolutionCandidates({
      ...l3Context(progression),
      level: 'tension',
    });
    expect(frozenL2.every((candidate) => candidate.score.status === 'UNEVALUATED')).toBe(true);
  });

  it('deduplicates identical progressions before diversity selection', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 5]));
    const candidate = generateEvolutionCandidates(context)[0];
    expect(candidate).toBeDefined();
    expect(rankEvolutionCandidates(context, [candidate!, candidate!])).toHaveLength(1);
  });

  it.each([
    { degrees: [0, 5], expected: 1 },
    { degrees: [0, 5, 3], expected: 2 },
    { degrees: [0, 5, 3, 4], expected: 3 },
  ])('safely returns $expected visible candidates', ({ degrees, expected }) => {
    expect(
      generateEvolutionCandidates(l3Context(triadProgression('C', 'major', degrees))),
    ).toHaveLength(expected);
  });

  it('hard-rejects a candidate whose dominant no longer resolves to its target', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 5]));
    const candidate = generateEvolutionCandidates(context)[0]!;
    const invalid = {
      ...candidate,
      after: candidate.after.map((chord, index) =>
        index === 2
          ? {
              ...chord,
              symbol: { ...chord.symbol, rootOffset: 0 },
            }
          : chord,
      ),
    };
    expect(rankEvolutionCandidates(context, [invalid])).toEqual([]);
  });

  it.each(MAJOR_KEYS)('is stable and unique in %s major', (tonic) => {
    const context = l3Context(triadProgression(tonic, 'major', [0, 5, 3, 4]), { tonic });
    const first = generateEvolutionCandidates(context);
    const second = generateEvolutionCandidates(context);
    expect(second).toEqual(first);
    expect(new Set(first.map((candidate) => candidate.id)).size).toBe(first.length);
    expect(
      new Set(first.map((candidate) => harmonicEffectForTechnique(candidate.technique))).size,
    ).toBeGreaterThanOrEqual(Math.min(2, first.length));
  });

  it('returns no reharm candidates for natural minor or chord scope', () => {
    expect(
      generateEvolutionCandidates(
        l3Context(triadProgression('A', 'minor', [0, 5]), {
          tonic: 'A',
          mode: 'minor',
        }),
      ),
    ).toEqual([]);
    expect(
      generateEvolutionCandidates(
        l3Context(triadProgression('C', 'major', [0, 5]), {
          scope: { kind: 'chord', index: 1 },
        }),
      ),
    ).toEqual([]);
  });

  it('uses the catalog suffix fallback for legacy chords without definitionId', () => {
    const legacy = triadProgression('C', 'major', [0, 5]).map((chord) => ({
      ...chord,
      symbol: {
        rootOffset: chord.symbol.rootOffset,
        suffix: chord.symbol.suffix,
      },
    }));
    expect(
      generateEvolutionCandidates(l3Context(legacy)).some(
        (candidate) => candidate.technique === 'secondary_dominant',
      ),
    ).toBe(true);
  });
});
