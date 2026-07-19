import {
  clampPercent,
  percentToVolume,
  positionToPercent,
  volumeToPercent,
} from '@/lib/volume';

describe('clampPercent', () => {
  it('rounds to an integer percent', () => {
    expect(clampPercent(49.4)).toBe(49);
    expect(clampPercent(49.6)).toBe(50);
  });

  it('clamps into [0, 100]', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(150)).toBe(100);
  });

  it('treats NaN as 0', () => {
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe('positionToPercent', () => {
  it('maps a coordinate on the track to a percent', () => {
    expect(positionToPercent(0, 200)).toBe(0);
    expect(positionToPercent(100, 200)).toBe(50);
    expect(positionToPercent(200, 200)).toBe(100);
  });

  it('clamps out-of-bounds touches', () => {
    expect(positionToPercent(-20, 200)).toBe(0);
    expect(positionToPercent(260, 200)).toBe(100);
  });

  it('returns 0 for a non-positive (unmeasured) width', () => {
    expect(positionToPercent(50, 0)).toBe(0);
    expect(positionToPercent(50, -10)).toBe(0);
  });
});

describe('volumeToPercent / percentToVolume', () => {
  it('converts linear volume to percent', () => {
    expect(volumeToPercent(0)).toBe(0);
    expect(volumeToPercent(0.85)).toBe(85);
    expect(volumeToPercent(1)).toBe(100);
  });

  it('converts percent back to linear volume', () => {
    expect(percentToVolume(0)).toBe(0);
    expect(percentToVolume(70)).toBeCloseTo(0.7, 5);
    expect(percentToVolume(100)).toBe(1);
  });

  it('round-trips whole percents', () => {
    for (const p of [0, 10, 33, 50, 90, 100]) {
      expect(volumeToPercent(percentToVolume(p))).toBe(p);
    }
  });
});
