import { DEFAULT_BASE_VOICING_PREFERENCE, type BaseVoicingNote } from '../../types';
import {
  LOW_CLUSTER_HARD_CEILING,
  V2_COST_WEIGHTS,
  evaluateCompactV2Cost,
  hasExtremeLowMinorSecond,
  minorSecondPenalty,
  requiredToneCost,
} from '../compactV2Costs';
import { intervalRole } from '../intervalRoles';

function note(
  pitch: number,
  interval: number,
  hand: BaseVoicingNote['hand'] = 'RH',
): BaseVoicingNote {
  return {
    pitch,
    pc: ((pitch % 12) + 12) % 12,
    interval,
    degree: 'root',
    hand,
    isBass: hand === 'LH',
    isDuplicate: false,
  };
}

const THIRTEENTH_CHORD = [0, 4, 7, 10, 14, 21];

describe('compact v2 interval roles', () => {
  it('classifies from intervals, never from chord symbols', () => {
    expect(intervalRole(11)).toBe('seventh');
    expect(intervalRole(0)).toBe('root');
    expect(intervalRole(13)).toBe('alteredTension');
    expect(intervalRole(15)).toBe('alteredTension');
    expect(intervalRole(18)).toBe('alteredTension');
    expect(intervalRole(20)).toBe('alteredTension');
    expect(intervalRole(14)).toBe('naturalTension');
    expect(intervalRole(4)).toBe('third');
  });
});

describe('compact v2 dissonance', () => {
  it('penalizes lower minor seconds more than higher ones', () => {
    const low = minorSecondPenalty(48, 49, 'structural', 0);
    const mid = minorSecondPenalty(60, 61, 'structural', 0);
    const high = minorSecondPenalty(70, 71, 'structural', 0);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(0);
  });

  it('keeps tension minor seconds cheaper than structural ones, but not free', () => {
    const structural = minorSecondPenalty(60, 61, 'structural', 0);
    const tension = minorSecondPenalty(60, 61, 'tension', 0);
    expect(tension).toBeGreaterThan(0);
    expect(tension).toBeLessThan(structural);
  });

  it('hard-rejects only extreme low-register minor seconds', () => {
    const lowCluster = [note(41, 0, 'LH'), note(48, 0), note(49, 13)];
    const midCluster = [note(41, 0, 'LH'), note(60, 0), note(61, 13)];
    expect(hasExtremeLowMinorSecond(lowCluster, DEFAULT_BASE_VOICING_PREFERENCE)).toBe(true);
    expect(hasExtremeLowMinorSecond(midCluster, DEFAULT_BASE_VOICING_PREFERENCE)).toBe(false);
    expect(LOW_CLUSTER_HARD_CEILING).toBe(52);
  });
});

describe('compact v2 required tones', () => {
  it('does not delete tension: missing ♭9 is far more expensive than spreading it', () => {
    const withFlatNine = evaluateCompactV2Cost(
      [note(36, 0, 'LH'), note(52, 4), note(58, 10), note(61, 13)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 0, availableIntervals: [0, 4, 7, 10, 13] },
    );
    const withoutFlatNine = evaluateCompactV2Cost(
      [note(36, 0, 'LH'), note(52, 4), note(55, 7), note(58, 10)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 0, availableIntervals: [0, 4, 7, 10, 13] },
    );
    expect(withFlatNine.hardReject).toBe(false);
    expect(withoutFlatNine.requiredToneCost).toBeGreaterThanOrEqual(
      V2_COST_WEIGHTS.TENSION_ABSENCE,
    );
    expect(withoutFlatNine.totalSoftCost).toBeGreaterThan(withFlatNine.totalSoftCost);
  });

  it('does not delete a major seventh to clear a cluster', () => {
    const withSeventh = evaluateCompactV2Cost(
      [note(41, 0, 'LH'), note(53, 0), note(57, 4), note(60, 7), note(64, 11)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 5, availableIntervals: [0, 4, 7, 11] },
    );
    const triad = evaluateCompactV2Cost(
      [note(41, 0, 'LH'), note(53, 0), note(57, 4), note(60, 7)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 5, availableIntervals: [0, 4, 7, 11] },
    );
    expect(triad.requiredToneCost).toBeGreaterThanOrEqual(V2_COST_WEIGHTS.GUIDE_TONE_ABSENCE);
    expect(triad.totalSoftCost).toBeGreaterThan(withSeventh.totalSoftCost);
  });

  it('charges a 13th chord that lost its 13th, even while it still holds the 9th', () => {
    const withNinthOnly = requiredToneCost(
      [note(36, 0, 'LH'), note(52, 4), note(58, 10), note(62, 14)],
      { rootPc: 0, availableIntervals: THIRTEENTH_CHORD },
    );
    expect(withNinthOnly).toBeGreaterThanOrEqual(V2_COST_WEIGHTS.TENSION_ABSENCE);
  });

  it('lets a lower extension yield once the identity extension is present', () => {
    const withThirteenthOnly = requiredToneCost(
      [note(36, 0, 'LH'), note(52, 4), note(58, 10), note(69, 21)],
      { rootPc: 0, availableIntervals: THIRTEENTH_CHORD },
    );
    const withNinthOnly = requiredToneCost(
      [note(36, 0, 'LH'), note(52, 4), note(58, 10), note(62, 14)],
      { rootPc: 0, availableIntervals: THIRTEENTH_CHORD },
    );
    expect(withThirteenthOnly).toBeLessThan(V2_COST_WEIGHTS.TENSION_ABSENCE);
    expect(withThirteenthOnly).toBeGreaterThanOrEqual(V2_COST_WEIGHTS.SECONDARY_TENSION_ABSENCE);
    expect(withThirteenthOnly).toBeLessThan(withNinthOnly);
  });

  it('prices a plain fifth as nearly free and a guide tone as mandatory', () => {
    const withoutFifth = requiredToneCost(
      [note(36, 0, 'LH'), note(52, 4), note(59, 11), note(62, 14)],
      { rootPc: 0, availableIntervals: [0, 4, 7, 11, 14] },
    );
    const withoutThird = requiredToneCost(
      [note(36, 0, 'LH'), note(55, 7), note(59, 11), note(62, 14)],
      { rootPc: 0, availableIntervals: [0, 4, 7, 11, 14] },
    );
    expect(withoutFifth).toBe(V2_COST_WEIGHTS.PERFECT_FIFTH_ABSENCE);
    expect(withoutThird).toBeGreaterThanOrEqual(V2_COST_WEIGHTS.GUIDE_TONE_ABSENCE);
  });
});
