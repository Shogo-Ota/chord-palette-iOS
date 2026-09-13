import { DANCE_GROOVE_PROFILE } from '../danceGrooveProfile';
import { closesRepeatedDropoutPhrase, danceDropoutSupportAttack } from '../danceDensityPolicy';

const attacksForBar = (bar: number) =>
  DANCE_GROOVE_PROFILE.bars[bar % DANCE_GROOVE_PROFILE.bars.length]!;

const SUPPORT = {
  onsetBeat: 1.5,
  durationBeat: 1,
  velocity: 80,
  selection: { kind: 'VOICE_ROLES', roles: ['BASS', 'RH_BOTTOM'] },
  velocityShape: { left: 80, rightByAscendingRank: [80] },
};

describe('Dance contextual density policy', () => {
  const dropout = DANCE_GROOVE_PROFILE.bars[6];
  const context = (overrides: Partial<Parameters<typeof danceDropoutSupportAttack>[1]>) => ({
    nextBarIsSplitHalfPair: false,
    closesRepeatedPhrase: false,
    ...overrides,
  });

  it('restores one restrained low pair before a split terminal bar', () => {
    expect(danceDropoutSupportAttack(dropout, context({ nextBarIsSplitHalfPair: true }))).toEqual(
      SUPPORT,
    );
  });

  it('restores the same pair when the dropout closes a repeated phrase', () => {
    expect(danceDropoutSupportAttack(dropout, context({ closesRepeatedPhrase: true }))).toEqual(
      SUPPORT,
    );
  });

  it('leaves the normal measured dropout untouched', () => {
    expect(danceDropoutSupportAttack(dropout, context({}))).toBeNull();
  });

  it('never adds the pair to canonical or roll/fill bars', () => {
    const both = context({ nextBarIsSplitHalfPair: true, closesRepeatedPhrase: true });
    expect(danceDropoutSupportAttack(DANCE_GROOVE_PROFILE.bars[0], both)).toBeNull();
    expect(danceDropoutSupportAttack(DANCE_GROOVE_PROFILE.bars[7], both)).toBeNull();
  });
});

describe('Dance repeated-phrase detection', () => {
  it('recognises the last dropout of a sixteen-bar progression', () => {
    expect(closesRepeatedDropoutPhrase({ bar: 14, lastBar: 15, attacksForBar })).toBe(true);
  });

  it('keeps the measured breath while a later phrase still follows', () => {
    expect(closesRepeatedDropoutPhrase({ bar: 6, lastBar: 15, attacksForBar })).toBe(false);
  });

  it('keeps the single breath of an eight-bar progression', () => {
    expect(closesRepeatedDropoutPhrase({ bar: 6, lastBar: 7, attacksForBar })).toBe(false);
  });

  it('answers no for bars that carry no dropout', () => {
    expect(closesRepeatedDropoutPhrase({ bar: 15, lastBar: 15, attacksForBar })).toBe(false);
    expect(closesRepeatedDropoutPhrase({ bar: 13, lastBar: 15, attacksForBar })).toBe(false);
  });

  it('supports only the last of three breaths', () => {
    expect(closesRepeatedDropoutPhrase({ bar: 14, lastBar: 23, attacksForBar })).toBe(false);
    expect(closesRepeatedDropoutPhrase({ bar: 22, lastBar: 23, attacksForBar })).toBe(true);
  });
});
