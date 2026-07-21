import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

import type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';

/**
 * Safety fallback for a MISCONFIGURED store build.
 *
 * If a production/preview build ships without a RevenueCat key we must NOT fall back
 * to {@link MockBillingProvider}: the Mock "purchases" Pro locally, which would unlock
 * paid features for free and ship a non-functional IAP (App Store rejection + zero
 * revenue). This provider instead:
 *   - never grants entitlements (always {@link NO_ENTITLEMENTS}),
 *   - fails purchase/restore with a clear message,
 *   - returns no offerings,
 * so the misconfiguration degrades safely (no free unlock) and is obvious in QA.
 *
 * It is only selected when `!__DEV__ && !env.revenueCatIosKey` (see billing/index.ts);
 * the correct fix is to inject the real key so the RevenueCat provider is used.
 */
const UNAVAILABLE_MESSAGE = '購入は現在利用できません。時間をおいて再度お試しください。';

export class DisabledBillingProvider implements BillingProvider {
  async init(): Promise<void> {
    /* nothing to resolve — entitlements are permanently empty. */
  }

  async getOfferings(): Promise<BillingProduct[]> {
    return [];
  }

  async purchasePro(): Promise<BillingResult> {
    return { status: 'error', message: UNAVAILABLE_MESSAGE };
  }

  async restore(): Promise<BillingResult> {
    return { status: 'error', message: UNAVAILABLE_MESSAGE };
  }

  getEntitlements(): Entitlements {
    return NO_ENTITLEMENTS;
  }

  onEntitlementsChange(): () => void {
    return () => {};
  }
}
