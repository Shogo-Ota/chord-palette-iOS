import { backbeatBeats, familyOf, profileFor } from '@/lib/performance/groove/drumProfiles';

/* ------------------------------------------------------------------ */
/* The profiles must mirror DrumProvider.pattern(for:) 1:1. These pins */
/* catch any drift between the native drums and the JS lock reference. */
/* ------------------------------------------------------------------ */
describe('drumProfiles — mirror of DrumProvider.swift', () => {
  it('pins every groove to its native kick / snare beats', () => {
    expect(profileFor('pop8')).toMatchObject({ family: 'eight', kickBeats: [0, 2], snareBeats: [1, 3], swing: false });
    expect(profileFor('pop16')).toMatchObject({ family: 'sixteen', kickBeats: [0, 2, 2.5], snareBeats: [1, 3] });
    expect(profileFor('rock8')).toMatchObject({ family: 'eight', kickBeats: [0, 2], snareBeats: [1, 3] });
    expect(profileFor('rock16')).toMatchObject({ family: 'sixteen', kickBeats: [0, 1.5, 2], snareBeats: [1, 3] });
    expect(profileFor('soul16')).toMatchObject({
      family: 'sixteen',
      kickBeats: [0, 2.5],
      snareBeats: [1, 3],
      ghostBeats: [1.75, 3.75],
    });
    expect(profileFor('clap')).toMatchObject({
      family: 'eight',
      kickBeats: [0, 2],
      snareBeats: [1, 3],
      swing: false,
    });
    expect(profileFor('bossaNova')).toMatchObject({
      family: 'swing',
      kickBeats: [0, 1.5, 2, 3.5],
      snareBeats: [],
      swing: false,
    });
  });

  it('no groove carries the triplet swing flag (Swing groove retired)', () => {
    const swung = ['pop8', 'pop16', 'rock8', 'rock16', 'soul16', 'clap', 'bossaNova'].filter(
      (id) => profileFor(id).swing,
    );
    expect(swung).toEqual([]);
  });

  it('unknown groove id falls back to pop8 (matches the native default)', () => {
    expect(profileFor('does-not-exist')).toEqual(profileFor('pop8'));
    expect(familyOf('does-not-exist')).toBe('eight');
  });
});

describe('familyOf', () => {
  it('reproduces the old GROOVE_FAMILY mapping', () => {
    expect(familyOf('pop8')).toBe('eight');
    expect(familyOf('rock8')).toBe('eight');
    expect(familyOf('pop16')).toBe('sixteen');
    expect(familyOf('rock16')).toBe('sixteen');
    expect(familyOf('soul16')).toBe('sixteen');
    expect(familyOf('clap')).toBe('eight');
    expect(familyOf('bossaNova')).toBe('swing');
  });
});

describe('backbeatBeats', () => {
  it('uses the groove snare beats when present', () => {
    expect(backbeatBeats(profileFor('pop8'))).toEqual([1, 3]);
  });

  it('falls back to the universal 2 & 4 for grooves without a backbeat snare (bossaNova)', () => {
    expect(profileFor('bossaNova').snareBeats).toEqual([]);
    expect(backbeatBeats(profileFor('bossaNova'))).toEqual([1, 3]);
  });
});
