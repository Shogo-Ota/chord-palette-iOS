import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { NO_ENTITLEMENTS } from '@/lib/entitlements';
import { __setBillingProviderForTests, billingService, useEntitlements } from '@/services/billing';
import { MockBillingProvider } from '@/services/billing/MockBillingProvider';

const PRODUCT_ID = 'palette_pro_monthly';

function AccessProbe({ screen }: { screen: 'editor' | 'presets' }) {
  const entitlements = useEntitlements();
  return <Text testID={`${screen}-tier`}>{entitlements.palettePro ? 'pro' : 'free'}</Text>;
}

describe('Editor and Presets entitlement subscriptions', () => {
  let provider: MockBillingProvider;

  beforeEach(() => {
    provider = new MockBillingProvider({ initial: NO_ENTITLEMENTS });
    __setBillingProviderForTests(provider);
  });

  it('rerenders both subscribers immediately after purchase', async () => {
    const view = render(
      <View>
        <AccessProbe screen="editor" />
        <AccessProbe screen="presets" />
      </View>,
    );

    expect(view.getByTestId('editor-tier').props.children).toBe('free');
    expect(view.getByTestId('presets-tier').props.children).toBe('free');

    await act(() => billingService.purchasePro(PRODUCT_ID));

    expect(view.getByTestId('editor-tier').props.children).toBe('pro');
    expect(view.getByTestId('presets-tier').props.children).toBe('pro');
  });

  it('rerenders both subscribers immediately after restore', async () => {
    await billingService.purchasePro(PRODUCT_ID);
    provider.__simulateColdStart();
    const view = render(
      <View>
        <AccessProbe screen="editor" />
        <AccessProbe screen="presets" />
      </View>,
    );

    expect(view.getByTestId('editor-tier').props.children).toBe('free');
    expect(view.getByTestId('presets-tier').props.children).toBe('free');

    await act(() => billingService.restore());

    expect(view.getByTestId('editor-tier').props.children).toBe('pro');
    expect(view.getByTestId('presets-tier').props.children).toBe('pro');
  });
});
