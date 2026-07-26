import type { Entitlements } from '@/lib/entitlements';

/**
 * Billing Provider abstraction (Strategy / Provider pattern).
 *
 * This is a *pure contract*: it depends only on the domain `Entitlements` type and
 * has no React Native / Expo / RevenueCat imports. Both `MockBillingProvider`
 * (Phase 5A) and the future `RevenueCatBillingProvider` (Phase 5B) implement it,
 * so screens and the domain never change when the concrete provider is swapped.
 *
 * The one-time-purchase → subscription product-model change (2026-07-18) is
 * absorbed *inside* this abstraction — the contract is independent of the purchase
 * form. `palettePro` is true only while a subscription is active and reverts to
 * false on lapse/cancellation (requirements §5.11).
 */

/** A (would-be) store subscription product. Price is a localized string (§5.11). */
export interface BillingProduct {
  /** Store product id, e.g. 'palette_pro_monthly'. */
  productId: string;
  /** Localized price string from the store, e.g. '¥500'. UI appends the period. */
  priceString: string;
  /** Subscription period. MVP ships monthly only; UI renders '/月'. */
  period: 'month';
  /** Human title, e.g. 'Palette Pro'. */
  title: string;
}

/**
 * Result of a purchase / restore / state change. The UI reads this to drive
 * feedback and analytics. `cancelled` is a user action, NOT a failure event.
 */
export type BillingResult =
  | { status: 'purchased'; entitlements: Entitlements }
  | { status: 'restored'; entitlements: Entitlements }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * The billing provider contract. `billingService` holds exactly one implementation
 * (dependency injection); the default is `MockBillingProvider`.
 */
export interface BillingProvider {
  /** Initialize and resolve the current active subscription state. */
  init(): Promise<void>;
  /** Fetch the displayable subscription products (localized price). */
  getOfferings(): Promise<BillingProduct[]>;
  /** Subscribe to Palette Pro (monthly). */
  purchasePro(): Promise<BillingResult>;
  /** Restore a previously purchased subscription. */
  restore(): Promise<BillingResult>;
  /** Current entitlements snapshot (palettePro=true only while active). */
  getEntitlements(): Entitlements;
  /**
   * Subscribe to entitlement changes (purchase / restore / lapse / cancellation).
   * Returns an unsubscribe function.
   */
  onEntitlementsChange(cb: (e: Entitlements) => void): () => void;
}
