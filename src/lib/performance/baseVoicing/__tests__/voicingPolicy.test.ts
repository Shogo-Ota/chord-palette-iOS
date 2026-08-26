import { DEFAULT_BASE_VOICING_PREFERENCE } from '../types';
import {
  LOW_CLUSTER_HARD_CEILING,
  VOICING_POLICY,
  evaluateVoicingPolicy,
  hasExtremeLowMinorSecond,
  intervalRole,
  minorSecondPenalty,
} from '../voicingPolicy';
import type { BaseVoicingNote } from '../types';

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

describe('voicingPolicy interval roles', () => {
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

describe('voicingPolicy dissonance', () => {
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

describe('voicingPolicy evaluation', () => {
  it('does not delete tension: missing ♭9 is far more expensive than spreading it', () => {
    const withFlatNine = evaluateVoicingPolicy(
      [note(36, 0, 'LH'), note(52, 4), note(58, 10), note(61, 13)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 0, availableIntervals: [0, 4, 7, 10, 13] },
    );
    const withoutFlatNine = evaluateVoicingPolicy(
      [note(36, 0, 'LH'), note(52, 4), note(55, 7), note(58, 10)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 0, availableIntervals: [0, 4, 7, 10, 13] },
    );
    expect(withFlatNine.hardReject).toBe(false);
    expect(withoutFlatNine.harmonicRoleCost).toBeGreaterThanOrEqual(VOICING_POLICY.TENSION_ABSENCE);
    expect(withoutFlatNine.totalSoftCost).toBeGreaterThan(withFlatNine.totalSoftCost);
  });

  it('does not delete a major seventh to clear a cluster', () => {
    const withSeventh = evaluateVoicingPolicy(
      [note(41, 0, 'LH'), note(53, 0), note(57, 4), note(60, 7), note(64, 11)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 5, availableIntervals: [0, 4, 7, 11] },
    );
    const triad = evaluateVoicingPolicy(
      [note(41, 0, 'LH'), note(53, 0), note(57, 4), note(60, 7)],
      DEFAULT_BASE_VOICING_PREFERENCE,
      { rootPc: 5, availableIntervals: [0, 4, 7, 11] },
    );
    expect(triad.harmonicRoleCost).toBeGreaterThanOrEqual(VOICING_POLICY.GUIDE_TONE_ABSENCE);
    expect(triad.totalSoftCost).toBeGreaterThan(withSeventh.totalSoftCost);
  });
});
