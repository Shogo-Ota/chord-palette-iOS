import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import PaywallScreen from '../paywall';

const mockGetOfferings = jest.fn();
const mockPurchasePro = jest.fn();
const mockRestore = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-linear-gradient', () => {
  const ReactRuntime = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      ReactRuntime.createElement(View, null, children),
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/components/GradientText', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ScreenScaffold', () => ({
  ScreenScaffold: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/billing', () => {
  const { subscriptionPeriodLabel } = jest.requireActual<
    typeof import('@/services/billing/BillingProvider')
  >('@/services/billing/BillingProvider');
  return {
    subscriptionPeriodLabel,
    billingService: {
      getOfferings: () => mockGetOfferings(),
      purchasePro: (productId: string) => mockPurchasePro(productId),
      restore: () => mockRestore(),
    },
  };
});

const MONTHLY_PRODUCT = {
  productId: 'palette_pro_monthly',
  priceString: '¥500',
  subscriptionPeriod: 'P1M',
  title: 'Palette Pro',
};

describe('Paywall billing package contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfferings.mockResolvedValue([MONTHLY_PRODUCT]);
    mockPurchasePro.mockResolvedValue({ status: 'cancelled' });
    mockRestore.mockResolvedValue({
      status: 'restored',
      entitlements: { palettePro: true, communityPlus: false },
    });
  });

  it('displays the resolved package period and purchases that exact product', async () => {
    const view = render(<PaywallScreen />);

    await waitFor(() => expect(view.getAllByText('¥500').length).toBeGreaterThan(0));
    expect(view.getAllByText('/ 月').length).toBeGreaterThan(0);
    expect(view.getByText('コードごとの伴奏STYLE')).toBeTruthy();

    fireEvent.press(view.getByText(/Palette Pro に登録する/));

    await waitFor(() => {
      expect(mockPurchasePro).toHaveBeenCalledWith('palette_pro_monthly');
    });
  });

  it('fails closed and disables purchase when no Offering package resolves', async () => {
    mockGetOfferings.mockResolvedValueOnce([]);
    const view = render(<PaywallScreen />);

    await waitFor(() => expect(view.getAllByText('利用できません').length).toBeGreaterThan(0));
    const purchaseButton = view.getByTestId('purchase-pro-button');
    expect(purchaseButton.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(purchaseButton);

    expect(mockPurchasePro).not.toHaveBeenCalled();
    expect(view.getByText(/商品情報を取得できないため/)).toBeTruthy();
  });

  it.each([
    ['purchase', 'Palette Pro に登録する'],
    ['restore', '購入を復元する'],
  ] as const)('returns to Editor after successful %s', async (kind, label) => {
    mockPurchasePro.mockResolvedValueOnce({
      status: 'purchased',
      entitlements: { palettePro: true, communityPlus: false },
    });
    const view = render(<PaywallScreen />);
    await waitFor(() => expect(view.getAllByText('¥500').length).toBeGreaterThan(0));
    jest.useFakeTimers();
    await act(async () => {
      fireEvent.press(view.getByText(new RegExp(label)));
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => jest.runOnlyPendingTimers());

    if (kind === 'purchase') expect(mockPurchasePro).toHaveBeenCalled();
    else expect(mockRestore).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
