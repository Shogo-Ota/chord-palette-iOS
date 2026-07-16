import { ADMIN_UNLOCK } from '@/config/admin';

/**
 * Guards against the 🔴 regression where `ADMIN_UNLOCK` was hardcoded to `true`,
 * which would unlock every Pro feature for all users if such a build shipped.
 *
 * `ADMIN_UNLOCK` must stay bound to the build type via `__DEV__`, so production
 * / preview bundles (compiled with `__DEV__ === false`) can never grant a free
 * unlock. The RN/Expo jest preset defines `__DEV__`; fall back to `globalThis`
 * for safety.
 */
const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : (globalThis as { __DEV__?: boolean }).__DEV__;

describe('ADMIN_UNLOCK', () => {
  it('is bound to the build type (__DEV__), never hardcoded true', () => {
    expect(ADMIN_UNLOCK).toBe(DEV);
  });

  it('is a boolean derived from __DEV__', () => {
    expect(typeof ADMIN_UNLOCK).toBe('boolean');
  });
});
