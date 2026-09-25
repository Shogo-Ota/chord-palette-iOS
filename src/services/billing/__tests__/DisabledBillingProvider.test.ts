import { DisabledBillingProvider } from '@/services/billing/DisabledBillingProvider';

describe('DisabledBillingProvider', () => {
  it('fails closed for offerings, purchase, restore, and entitlements', async () => {
    const provider = new DisabledBillingProvider();

    await expect(provider.getOfferings()).resolves.toEqual([]);
    await expect(provider.purchasePro('palette_pro_monthly')).resolves.toMatchObject({
      status: 'error',
    });
    await expect(provider.restore()).resolves.toMatchObject({ status: 'error' });
    expect(provider.getEntitlements()).toEqual({
      palettePro: false,
      communityPlus: false,
    });
  });
});
