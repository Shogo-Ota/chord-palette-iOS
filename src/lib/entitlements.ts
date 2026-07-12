/**
 * Entitlement model (pure). `palette_pro` is a one-time purchase (local composing
 * unlocks); `community_plus` is a subscription (cloud/SNS unlocks). They are
 * independent — a user may hold either, both, or neither (requirements §8).
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
