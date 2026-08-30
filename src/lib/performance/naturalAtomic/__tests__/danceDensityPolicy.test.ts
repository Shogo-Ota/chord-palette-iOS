import { DANCE_GROOVE_PROFILE } from '../danceGrooveProfile';
import { splitTerminalBarSupportAttack } from '../danceDensityPolicy';

describe('Dance contextual density policy', () => {
  const dropout = DANCE_GROOVE_PROFILE.bars[6];

  it('restores one restrained low pair before a split terminal bar', () => {
    expect(splitTerminalBarSupportAttack(dropout, true)).toEqual({
      onsetBeat: 1.5,
      durationBeat: 1,
      velocity: 80,
      selection: { kind: 'VOICE_ROLES', roles: ['BASS', 'RH_BOTTOM'] },
      velocityShape: { left: 80, rightByAscendingRank: [80] },
    });
  });

  it('leaves the normal measured dropout untouched', () => {
    expect(splitTerminalBarSupportAttack(dropout, false)).toBeNull();
  });

  it('never adds the pair to canonical or roll/fill bars', () => {
    expect(splitTerminalBarSupportAttack(DANCE_GROOVE_PROFILE.bars[0], true)).toBeNull();
    expect(splitTerminalBarSupportAttack(DANCE_GROOVE_PROFILE.bars[7], true)).toBeNull();
  });
});
