import {
  L3_INSERTION_POLICY,
  L3_RANKING_POLICY,
  splitL3InsertionDuration,
} from '@/lib/musicTheory';

import { L3_GOLDEN_PROGRESSIONS, l3Context } from '../testing/l3Progressions';

describe('L3 contracts and policy', () => {
  it('splits only editor-supported insertion durations while preserving total beats', () => {
    expect(splitL3InsertionDuration(4)).toEqual([2, 2]);
    expect(splitL3InsertionDuration(2)).toEqual([1, 1]);
    expect(splitL3InsertionDuration(1)).toBeNull();

    for (const duration of [4, 2] as const) {
      const split = splitL3InsertionDuration(duration);
      if (!split) throw new Error(`Expected ${duration} beats to be splittable`);
      expect(split[0] + split[1]).toBe(duration);
    }
    expect(L3_INSERTION_POLICY.preserveTotalBeats).toBe(true);
  });

  it('keeps ranking and insertion decisions explicitly app-policy sourced', () => {
    expect(L3_INSERTION_POLICY.source.kind).toBe('APP_POLICY_PROPOSED');
    expect(L3_RANKING_POLICY.source.kind).toBe('APP_POLICY_PROPOSED');
    expect(L3_RANKING_POLICY.maximumCandidates).toBe(3);
    expect(Object.keys(L3_RANKING_POLICY.componentWeights)).toEqual([
      'resolutionStrength',
      'voiceLeadingCost',
      'bassMovementCost',
      'commonToneScore',
      'harmonicFunctionFit',
      'tensionValidity',
      'complexityDelta',
    ]);
  });

  it('provides stable major progression fixtures for every L3 technique', () => {
    expect(Object.keys(L3_GOLDEN_PROGRESSIONS)).toEqual([
      'secondaryDominant',
      'passingDiminished',
      'tritoneSubstitution',
    ]);
    for (const progression of Object.values(L3_GOLDEN_PROGRESSIONS)) {
      const context = l3Context(progression);
      expect(context).toMatchObject({
        tonic: 'C',
        mode: 'major',
        scope: { kind: 'progression' },
        level: 'reharm',
      });
    }
  });

  it('can explicitly represent the natural-minor fail-closed context', () => {
    expect(
      l3Context(L3_GOLDEN_PROGRESSIONS.secondaryDominant, {
        tonic: 'A',
        mode: 'minor',
      }),
    ).toMatchObject({ tonic: 'A', mode: 'minor', level: 'reharm' });
  });
});
