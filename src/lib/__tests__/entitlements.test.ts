import { NO_ENTITLEMENTS, isLocked, type Entitlements } from '@/lib/entitlements';

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
