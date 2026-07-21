import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';
import { logger } from '@/lib/logger';

import type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';

/**
 * RevenueCat-backed billing provider (Phase 5B — real store billing).
 *
 * Implements the pure {@link BillingProvider} contract using `react-native-purchases`,
 * so screens and the domain never change when this replaces `MockBillingProvider`.
 * RevenueCat's `customerInfo` is the client-side source of truth: `palettePro` is
 * true only while the `palette_pro` entitlement is active, and reverts on
 * lapse/cancellation (requirements §5.11). `communityPlus` is not sold yet (V2).
 *
 * The one-time-purchase → monthly-subscription product-model change is absorbed here
 * (the contract is purchase-form agnostic). Permanent verification is server-side
 * (Convex) in a later phase; this client entitlement is provisional.
 */

/** RevenueCat entitlement identifier that unlocks Palette Pro. */
const PALETTE_PRO_ENTITLEMENT = 'palette_pro';

const PURCHASE_ERROR_MESSAGE = '購入処理に失敗しました。時間をおいて再度お試しください。';
const RESTORE_ERROR_MESSAGE = '復元に失敗しました。時間をおいて再度お試しください。';
const NO_RESTORE_MESSAGE = '復元できるサブスクリプションが見つかりませんでした。';
const NO_PRODUCT_MESSAGE = '商品情報を取得できませんでした。時間をおいて再度お試しください。';

/** Map RevenueCat customerInfo → domain entitlements (active entitlement presence). */
function toEntitlements(info: CustomerInfo): Entitlements {
  const active = info.entitlements.active ?? {};
  return {
    palettePro: PALETTE_PRO_ENTITLEMENT in active,
    // Community / cloud unlocks are not sold in v1 (V2). Never granted by the store.
    communityPlus: false,
  };
}

/** Whether a thrown purchase error is a user cancellation (not a failure). */
function isUserCancelled(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { userCancelled?: boolean }).userCancelled === true
  );
}

export class RevenueCatBillingProvider implements BillingProvider {
  private readonly apiKey: string;
  private entitlements: Entitlements = NO_ENTITLEMENTS;
  private readonly listeners = new Set<(e: Entitlements) => void>();
  private configured = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async init(): Promise<void> {
    if (!this.configured) {
      Purchases.configure({ apiKey: this.apiKey });
      Purchases.addCustomerInfoUpdateListener((info) => this.applyCustomerInfo(info));
      this.configured = true;
    }
    try {
      const info = await Purchases.getCustomerInfo();
      this.applyCustomerInfo(info);
    } catch (e) {
      logger.error('RevenueCat getCustomerInfo failed', { error: String(e) });
    }
  }

  async getOfferings(): Promise<BillingProduct[]> {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((p) => toProduct(p));
  }

  async purchasePro(): Promise<BillingResult> {
    let pkg: PurchasesPackage | null;
    try {
      pkg = await this.resolveProPackage();
    } catch (e) {
      logger.error('RevenueCat getOfferings failed', { error: String(e) });
      return { status: 'error', message: NO_PRODUCT_MESSAGE };
    }
    if (!pkg) return { status: 'error', message: NO_PRODUCT_MESSAGE };

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      this.applyCustomerInfo(customerInfo);
      return { status: 'purchased', entitlements: this.entitlements };
    } catch (e) {
      if (isUserCancelled(e)) return { status: 'cancelled' };
      logger.error('RevenueCat purchase failed', { error: String(e) });
      return { status: 'error', message: PURCHASE_ERROR_MESSAGE };
    }
  }

  async restore(): Promise<BillingResult> {
    try {
      const info = await Purchases.restorePurchases();
      this.applyCustomerInfo(info);
      if (this.entitlements.palettePro) {
        return { status: 'restored', entitlements: this.entitlements };
      }
      return { status: 'error', message: NO_RESTORE_MESSAGE };
    } catch (e) {
      logger.error('RevenueCat restore failed', { error: String(e) });
      return { status: 'error', message: RESTORE_ERROR_MESSAGE };
    }
  }

  getEntitlements(): Entitlements {
    return this.entitlements;
  }

  onEntitlementsChange(cb: (e: Entitlements) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** The monthly Palette Pro package from the current offering (fallback: first). */
  private async resolveProPackage(): Promise<PurchasesPackage | null> {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return current.monthly ?? current.availablePackages[0] ?? null;
  }

  private applyCustomerInfo(info: CustomerInfo): void {
    const next = toEntitlements(info);
    if (
      next.palettePro === this.entitlements.palettePro &&
      next.communityPlus === this.entitlements.communityPlus
    ) {
      return;
    }
    this.entitlements = next;
    this.listeners.forEach((l) => l(next));
  }
}

/** Map a RevenueCat package → the UI-facing product (localized price string). */
function toProduct(p: PurchasesPackage): BillingProduct {
  return {
    productId: p.product.identifier,
    priceString: p.product.priceString,
    period: 'month',
    title: p.product.title || 'Palette Pro',
  };
}
