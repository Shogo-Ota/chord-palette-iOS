/**
 * Entitlement model (pure). `palette_pro` is an auto-renewing monthly subscription
 * (¥490/月) that unlocks local composing Pro features — true only while the
 * subscription is active, false on lapse/cancellation (requirements §5.11, product
 * model updated 2026-07-18). `community_plus` is a separate subscription (cloud/SNS
 * unlocks). They are independent — a user may hold either, both, or neither (§8).
 */
export type Entitlements = {
  palettePro: boolean;
  communityPlus: boolean;
};

export const NO_ENTITLEMENTS: Entitlements = { palettePro: false, communityPlus: false };

/** Whether a Palette-Pro-flagged item is locked given the current entitlements. */
export function isLocked(isPro: boolean | undefined, entitlements: Entitlements): boolean {
  return !!isPro && !entitlements.palettePro;
}
