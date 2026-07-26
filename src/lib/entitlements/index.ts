import type { Capability, LimitKey } from './capabilities';
import { FREE_POLICY, PRO_POLICY, type TierPolicy } from './policy';

export { UNLIMITED, type Capability, type LimitKey } from './capabilities';
export { FREE_POLICY, PRO_POLICY, type TierPolicy } from './policy';

/**
 * Entitlement model (pure). `palette_pro` is an auto-renewing monthly subscription
 * (¥500/月) that unlocks local composing Pro features — true only while the
 * subscription is active, false on lapse/cancellation (requirements §5.11, product
 * model updated 2026-07-18). `community_plus` is a separate subscription (cloud/SNS
 * unlocks). They are independent — a user may hold either, both, or neither (§8).
 */
export type Entitlements = {
  palettePro: boolean;
  communityPlus: boolean;
};

export const NO_ENTITLEMENTS: Entitlements = { palettePro: false, communityPlus: false };

/** The tier a set of entitlements resolves to. One place decides this. */
export function policyFor(entitlements: Entitlements): TierPolicy {
  return entitlements.palettePro ? PRO_POLICY : FREE_POLICY;
}

/** Whether the current entitlements permit a capability. */
export function can(entitlements: Entitlements, capability: Capability): boolean {
  return policyFor(entitlements).allows[capability];
}

/** The current tier's ceiling for a quantity. Compare against it; never inline it. */
export function limitFor(entitlements: Entitlements, key: LimitKey): number {
  return policyFor(entitlements).limits[key];
}

/**
 * Whether a Palette-Pro-flagged item is locked given the current entitlements.
 *
 * This is the older, coarser gate: the caller has already decided an item is paid
 * and only asks whether to show a padlock. It stays because ~20 call sites read
 * naturally that way, but new gates should name the capability through `can()` so
 * the reason for the lock survives in the code.
 */
export function isLocked(isPro: boolean | undefined, entitlements: Entitlements): boolean {
  return !!isPro && policyFor(entitlements).id !== 'pro';
}
