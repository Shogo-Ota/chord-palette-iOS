import { RevenueCatBillingProvider } from '@/services/billing/RevenueCatBillingProvider';

const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockAddCustomerInfoUpdateListener = jest.fn();

const mockPurchases = {
  configure: jest.fn(),
  getOfferings: mockGetOfferings,
  purchasePackage: mockPurchasePackage,
  restorePurchases: mockRestorePurchases,
  getCustomerInfo: mockGetCustomerInfo,
  addCustomerInfoUpdateListener: mockAddCustomerInfoUpdateListener,
};

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
}));

const annualPackage = {
  identifier: '$rc_annual',
  packageType: 'ANNUAL',
  product: {
    identifier: 'palette_pro_annual',
    priceString: '¥5,000',
    subscriptionPeriod: 'P1Y',
    title: 'Palette Pro Annual',
  },
};

const monthlyPackage = {
  identifier: '$rc_monthly',
  packageType: 'MONTHLY',
  product: {
    identifier: 'palette_pro_monthly',
    priceString: '¥500',
    subscriptionPeriod: 'P1M',
    title: 'Palette Pro Monthly',
  },
};

function offerings(current = true) {
  return {
    current: current
      ? {
          monthly: monthlyPackage,
          annual: annualPackage,
          availablePackages: [annualPackage, monthlyPackage],
        }
      : null,
  };
}

function customerInfo(palettePro: boolean) {
  return {
    entitlements: {
      active: palettePro ? { palette_pro: { identifier: 'palette_pro' } } : {},
    },
  };
}

describe('RevenueCatBillingProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue(offerings());
    mockPurchasePackage.mockResolvedValue({ customerInfo: customerInfo(true) });
    mockRestorePurchases.mockResolvedValue(customerInfo(true));
    mockGetCustomerInfo.mockResolvedValue(customerInfo(false));
  });

  it('uses one monthly resolver for both Paywall display and purchase', async () => {
    const provider = new RevenueCatBillingProvider('test-key', mockPurchases as never);

    await expect(provider.getOfferings()).resolves.toEqual([
      {
        productId: 'palette_pro_monthly',
        priceString: '¥500',
        subscriptionPeriod: 'P1M',
        title: 'Palette Pro Monthly',
      },
    ]);

    await expect(provider.purchasePro('palette_pro_monthly')).resolves.toMatchObject({
      status: 'purchased',
      entitlements: { palettePro: true },
    });
    expect(mockPurchasePackage).toHaveBeenCalledWith(monthlyPackage);
    expect(mockPurchasePackage).not.toHaveBeenCalledWith(annualPackage);
  });

  it('fails closed when the displayed product no longer matches the purchasable package', async () => {
    const provider = new RevenueCatBillingProvider('test-key', mockPurchases as never);

    await expect(provider.purchasePro('different-product')).resolves.toMatchObject({
      status: 'error',
    });
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });

  it('does not report purchase success without the palette_pro entitlement', async () => {
    mockPurchasePackage.mockResolvedValueOnce({ customerInfo: customerInfo(false) });
    const provider = new RevenueCatBillingProvider('test-key', mockPurchases as never);

    await expect(provider.purchasePro('palette_pro_monthly')).resolves.toMatchObject({
      status: 'error',
    });
    expect(provider.getEntitlements().palettePro).toBe(false);
  });

  it('does not report restore success without the palette_pro entitlement', async () => {
    mockRestorePurchases.mockResolvedValueOnce(customerInfo(false));
    const provider = new RevenueCatBillingProvider('test-key', mockPurchases as never);

    await expect(provider.restore()).resolves.toMatchObject({ status: 'error' });
    expect(provider.getEntitlements().palettePro).toBe(false);
  });

  it('returns no product and rejects purchase when the Offering is unavailable', async () => {
    mockGetOfferings.mockResolvedValue(offerings(false));
    const provider = new RevenueCatBillingProvider('test-key', mockPurchases as never);

    await expect(provider.getOfferings()).resolves.toEqual([]);
    await expect(provider.purchasePro('palette_pro_monthly')).resolves.toMatchObject({
      status: 'error',
    });
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });
});
