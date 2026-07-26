import {
  FREE_POLICY,
  NO_ENTITLEMENTS,
  PRO_POLICY,
  UNLIMITED,
  can,
  isLocked,
  limitFor,
  policyFor,
  type Capability,
  type Entitlements,
} from '@/lib/entitlements';

const PRO: Entitlements = { palettePro: true, communityPlus: false };

describe('isLocked', () => {
  it('locks Pro items without the palette_pro entitlement', () => {
    expect(isLocked(true, NO_ENTITLEMENTS)).toBe(true);
  });

  it('unlocks Pro items with the palette_pro entitlement', () => {
    expect(isLocked(true, PRO)).toBe(false);
  });

  it('never locks free items', () => {
    expect(isLocked(false, NO_ENTITLEMENTS)).toBe(false);
    expect(isLocked(undefined, NO_ENTITLEMENTS)).toBe(false);
  });

  it('treats community_plus independently from palette_pro', () => {
    const communityOnly: Entitlements = { palettePro: false, communityPlus: true };
    expect(isLocked(true, communityOnly)).toBe(true);
  });
});

describe('tier policy', () => {
  it('resolves the tier from palette_pro alone', () => {
    expect(policyFor(NO_ENTITLEMENTS)).toBe(FREE_POLICY);
    expect(policyFor(PRO)).toBe(PRO_POLICY);
    expect(policyFor({ palettePro: false, communityPlus: true })).toBe(FREE_POLICY);
  });

  it('never gives the free tier something Pro does not have', () => {
    const overreach = (Object.keys(FREE_POLICY.allows) as Capability[]).filter(
      (c) => FREE_POLICY.allows[c] && !PRO_POLICY.allows[c],
    );
    expect(overreach).toEqual([]);
  });

  it('never caps Pro below free', () => {
    for (const key of ['projects', 'favourites', 'videoHeight'] as const) {
      expect({ key, ok: PRO_POLICY.limits[key] >= FREE_POLICY.limits[key] }).toEqual({
        key,
        ok: true,
      });
    }
  });

  it('answers a capability through the tier', () => {
    expect(can(NO_ENTITLEMENTS, 'chord.altered')).toBe(false);
    expect(can(PRO, 'chord.altered')).toBe(true);
  });

  it('keeps unshipped capabilities off even for subscribers', () => {
    // Reading true here would let the paywall advertise something that does not
    // exist yet, which is the 2.3.1 rejection we already took once.
    expect(can(PRO, 'midi.export')).toBe(false);
    expect(can(PRO, 'theory.substitution')).toBe(false);
  });

  it('reads a quantity as a number rather than a flag', () => {
    expect(limitFor(NO_ENTITLEMENTS, 'projects')).toBe(5);
    expect(limitFor(NO_ENTITLEMENTS, 'videoHeight')).toBe(1280);
    expect(limitFor(PRO, 'projects')).toBe(UNLIMITED);
    expect(limitFor(PRO, 'videoHeight')).toBe(1920);
  });
});
