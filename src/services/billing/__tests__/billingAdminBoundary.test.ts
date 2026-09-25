/* eslint-disable @typescript-eslint/no-require-imports */

describe('Billing final Admin entitlement boundary', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/config/admin');
    jest.dontMock('@/features/admin/adminMode');
  });

  it('does not grant Pro outside Development even if Admin memory says true', () => {
    jest.doMock('@/config/admin', () => ({ ADMIN_UNLOCK: false }));
    jest.doMock('@/features/admin/adminMode', () => ({
      isAdminMode: () => true,
      subscribeAdminMode: () => () => {},
    }));

    let billing!: typeof import('@/services/billing');
    jest.isolateModules(() => {
      billing = require('@/services/billing');
    });

    expect(billing.getEntitlements().palettePro).toBe(false);
  });

  it('preserves the Development-only Admin entitlement override', () => {
    jest.doMock('@/config/admin', () => ({ ADMIN_UNLOCK: true }));
    jest.doMock('@/features/admin/adminMode', () => ({
      isAdminMode: () => true,
      subscribeAdminMode: () => () => {},
    }));

    let billing!: typeof import('@/services/billing');
    jest.isolateModules(() => {
      billing = require('@/services/billing');
    });

    expect(billing.getEntitlements().palettePro).toBe(true);
  });
});
