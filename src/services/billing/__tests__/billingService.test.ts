import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import {
  __setBillingProviderForTests,
  billingService,
  getEntitlements,
} from '@/services/billing';
import { MockBillingProvider } from '@/services/billing/MockBillingProvider';

/**
 * Sprint 5A contract: subscribe → entitlement transition, restore, lapse revert,
 * failure, cancellation, and listener notification. Each test injects a fresh Mock
 * (starting unsubscribed) so the global entitlement snapshot is deterministic
 * regardless of the admin/dev unlock default.
 */
let mock: MockBillingProvider;

beforeEach(() => {
  mock = new MockBillingProvider({ initial: NO_ENTITLEMENTS });
  __setBillingProviderForTests(mock);
});

describe('billingService.getOfferings', () => {
  it('returns a monthly Palette Pro product with a localized price string', async () => {
    const products = await billingService.getOfferings();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productId: 'palette_pro_monthly',
      priceString: '¥490',
      period: 'month',
    });
  });
});

describe('billingService.purchasePro', () => {
  it('activates the subscription and flips palettePro to true', async () => {
    expect(getEntitlements().palettePro).toBe(false);

    const result = await billingService.purchasePro();

    expect(result.status).toBe('purchased');
    if (result.status === 'purchased') {
      expect(result.entitlements.palettePro).toBe(true);
    }
    expect(getEntitlements().palettePro).toBe(true);
  });

  it('does not change entitlements on an injected purchase error', async () => {
    mock.__setNextPurchaseOutcome('error');

    const result = await billingService.purchasePro();

    expect(result.status).toBe('error');
    expect(getEntitlements().palettePro).toBe(false);
  });

  it('treats cancellation as a no-op (not an error, no entitlement change)', async () => {
    mock.__setNextPurchaseOutcome('cancelled');

    const result = await billingService.purchasePro();

    expect(result.status).toBe('cancelled');
    expect(getEntitlements().palettePro).toBe(false);
  });
});

describe('billingService.restore', () => {
  it('restores an active subscription after a cold start', async () => {
    await billingService.purchasePro();
    mock.__simulateColdStart();
    expect(getEntitlements().palettePro).toBe(false);

    const result = await billingService.restore();

    expect(result.status).toBe('restored');
    expect(getEntitlements().palettePro).toBe(true);
  });

  it('returns an error when there is nothing to restore', async () => {
    const result = await billingService.restore();

    expect(result.status).toBe('error');
    expect(getEntitlements().palettePro).toBe(false);
  });
});

describe('subscription lapse / cancellation', () => {
  it('reverts palettePro to false when the subscription expires', async () => {
    await billingService.purchasePro();
    expect(getEntitlements().palettePro).toBe(true);

    mock.__expireSubscription();

    expect(getEntitlements().palettePro).toBe(false);
  });

  it('re-activates on re-purchase after a lapse', async () => {
    await billingService.purchasePro();
    mock.__expireSubscription();
    expect(getEntitlements().palettePro).toBe(false);

    const result = await billingService.purchasePro();

    expect(result.status).toBe('purchased');
    expect(getEntitlements().palettePro).toBe(true);
  });
});

describe('listener notification', () => {
  it('notifies provider subscribers on purchase and on lapse', async () => {
    const seen: Entitlements[] = [];
    const unsubscribe = mock.onEntitlementsChange((e) => seen.push(e));

    await billingService.purchasePro();
    mock.__expireSubscription();
    unsubscribe();
    // A change after unsubscribe must not be observed.
    await billingService.purchasePro();

    expect(seen.map((e) => e.palettePro)).toEqual([true, false]);
  });

  it('keeps community_plus independent from a Palette Pro purchase', async () => {
    const withCommunity = new MockBillingProvider({
      initial: { palettePro: false, communityPlus: true },
    });
    __setBillingProviderForTests(withCommunity);

    await billingService.purchasePro();

    expect(getEntitlements()).toEqual<Entitlements>({ palettePro: true, communityPlus: true });
  });
});
