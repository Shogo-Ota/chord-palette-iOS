/**
 * Admin / owner unlock switch.
 *
 * The app owner (developer/administrator) should be able to use every Pro feature
 * without a purchase while building the app. Until a real admin identity check
 * lands (Clerk role + Convex server verification in Phase 4), this single flag
 * grants full entitlements — but ONLY in dev builds.
 *
 * Bound to React Native/Expo's global `__DEV__`:
 *   - dev server / EAS Development Build → `true`  (owner gets full unlock)
 *   - production / preview builds        → `false` (structurally, always)
 *
 * Because production bundles are compiled with `__DEV__ === false`, there is no
 * build that ships to TestFlight / the App Store with this unlocked. No manual
 * "flip before release" step is required — the guard makes it automatic. The
 * permanent fix is the Phase 4 Clerk role + Convex server-side verification.
 */
export const ADMIN_UNLOCK = __DEV__;
