import { shippedPerks } from '@/features/paywall/perks';
import { PRO_POLICY } from '@/lib/entitlements';

describe('paywall perks', () => {
  it('has something to sell', () => {
    expect(shippedPerks().length).toBeGreaterThan(0);
  });

  it('only claims capabilities Palette Pro actually grants', () => {
    // The 2.3.1 guard: build 5 went to review promising extra presets over an
    // empty catalog, so the paywall must not be able to outrun the policy.
    for (const perk of shippedPerks()) {
      const missing = perk.claims.filter((c) => !PRO_POLICY.allows[c]);
      expect({ perk: perk.title, missing }).toEqual({ perk: perk.title, missing: [] });
    }
  });

  it('hides a perk whose feature has not shipped', () => {
    // MIDI export is written into the catalog but withheld by the policy, which
    // is the case that proves the filter does something.
    expect(PRO_POLICY.allows['midi.export']).toBe(false);
    expect(shippedPerks().map((p) => p.title)).not.toContain('MIDI 書き出し');
  });

  it('gives each shown perk a distinct title', () => {
    const titles = shippedPerks().map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
