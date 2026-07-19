import { NO_ENTITLEMENTS, type Entitlements } from '@/lib/entitlements';

import type { BillingProduct, BillingProvider, BillingResult } from './BillingProvider';

/**
 * In-memory Mock billing provider (Phase 5A).
 *
 * Simulates the subscription lifecycle without any store / RevenueCat dependency:
 * purchase, restore, cancellation, error injection, and subscription lapse. It is
 * pure TypeScript (no React Native / Expo) so it runs in unit tests and in the app
 * (Metro reload — no native rebuild).
 *
 * DELIBERATE LIMITATION (5A): the subscription state is NOT persisted — a real app
 * restart returns to "not subscribed". The store record is modeled by an in-memory
 * `storeHasActivePro` flag so `restore()` can be exercised. Phase 5B replaces this
 * with `RevenueCatBillingProvider`, where customerInfo's active entitlement is the
 * source of truth. Client-side entitlement is provisional; permanent verification
 * happens server-side (Convex) in Phase 4.
 */

/** Default (would-be) store product for Palette Pro monthly (¥490 / 月). */
export const PALETTE_PRO_PRODUCT: BillingProduct = {
  productId: 'palette_pro_monthly',
  priceString: '¥490',
  period: 'month',
  title: 'Palette Pro',
};

/** Outcome that can be forced onto the next purchase/restore attempt (test hooks). */
export type MockOutcome = 'success' | 'cancelled' | 'error';

export interface MockBillingOptions {
  /** Entitlements to start from (e.g. admin builds start fully unlocked). */
  initial?: Entitlements;
  /** Product returned by `getOfferings()`. */
  product?: BillingProduct;
  /** Message returned on an injected error outcome. */
  errorMessage?: string;
}

const DEFAULT_ERROR_MESSAGE = '購入処理に失敗しました。時間をおいて再度お試しください。';
const NO_RESTORE_MESSAGE = '復元できるサブスクリプションが見つかりませんでした。';

export class MockBillingProvider implements BillingProvider {
  private entitlements: Entitlements;
  private readonly product: BillingProduct;
  private readonly errorMessage: string;
  /** Whether the (simulated) store holds an active subscription — drives restore. */
  private storeHasActivePro: boolean;
  private nextPurchaseOutcome: MockOutcome = 'success';
  private nextRestoreOutcome: MockOutcome | null = null;
  private readonly listeners = new Set<(e: Entitlements) => void>();

  constructor(opts: MockBillingOptions = {}) {
    this.entitlements = opts.initial ?? NO_ENTITLEMENTS;
    this.product = opts.product ?? PALETTE_PRO_PRODUCT;
    this.errorMessage = opts.errorMessage ?? DEFAULT_ERROR_MESSAGE;
    this.storeHasActivePro = this.entitlements.palettePro;
  }

  async init(): Promise<void> {
    // Mock does not persist across restarts; there is nothing to resolve. Real
    // providers resolve customerInfo here. Emit so subscribers sync the snapshot.
    this.emit();
  }

  async getOfferings(): Promise<BillingProduct[]> {
    return [this.product];
  }

  async purchasePro(): Promise<BillingResult> {
    const outcome = this.nextPurchaseOutcome;
    this.nextPurchaseOutcome = 'success'; // one-shot injection; reset after use
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'error') return { status: 'error', message: this.errorMessage };
    this.storeHasActivePro = true;
    this.setPalettePro(true);
    return { status: 'purchased', entitlements: this.entitlements };
  }

  async restore(): Promise<BillingResult> {
    const outcome = this.nextRestoreOutcome;
    this.nextRestoreOutcome = null; // one-shot injection; reset after use
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'error') return { status: 'error', message: this.errorMessage };
    if (!this.storeHasActivePro) {
      return { status: 'error', message: NO_RESTORE_MESSAGE };
    }
    this.setPalettePro(true);
    return { status: 'restored', entitlements: this.entitlements };
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

  /* ---- Dev/test injection (Mock only; never part of the real provider) ------- */

  /** Force the outcome of the next `purchasePro()` call. */
  __setNextPurchaseOutcome(outcome: MockOutcome): void {
    this.nextPurchaseOutcome = outcome;
  }

  /** Force the outcome of the next `restore()` call. */
  __setNextRestoreOutcome(outcome: MockOutcome): void {
    this.nextRestoreOutcome = outcome;
  }

  /** Simulate a lapse/cancellation: Pro revoked locally AND in the store. */
  __expireSubscription(): void {
    this.storeHasActivePro = false;
    this.setPalettePro(false);
  }

  /** Simulate a fresh install: local Pro lost, store still active (for restore). */
  __simulateColdStart(): void {
    this.setPalettePro(false);
  }

  private setPalettePro(active: boolean): void {
    if (this.entitlements.palettePro === active) return;
    this.entitlements = { ...this.entitlements, palettePro: active };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.entitlements;
    this.listeners.forEach((l) => l(snapshot));
  }
}
