/**
 * Legal document URLs (single source of truth).
 *
 * App Store Guideline 3.1.2 requires an auto-renewing subscription app to expose
 * FUNCTIONAL links to the Terms of Use (EULA) and Privacy Policy inside the binary
 * (typically on the paywall), and the same URLs must be registered in App Store
 * Connect metadata.
 *
 * - Terms of Use: defaults to Apple's Standard EULA, which Apple accepts when you do
 *   not host a custom one. Replace with your own hosted terms if you have them.
 * - Privacy Policy: MUST be a real, reachable page describing what the app collects
 *   (analytics via PostHog, crash reports via Sentry, purchase data via RevenueCat).
 *   `PRIVACY_POLICY_URL` below is a PLACEHOLDER — host a real page and update it
 *   before submission, or the review will fail.
 */

/** Apple's Standard License Agreement (EULA) — accepted in lieu of a custom one. */
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * Hosted on GitHub Pages (repo `Shogo-Ota/chord-palette-iOS-policy`, separate
 * from the code repo `chord-palette-iOS`). Page source lives in
 * `/site/privacy.html` and `/site/support.html`. The same URLs go into App Store
 * Connect metadata (Privacy Policy URL and Support URL).
 */
export const PRIVACY_POLICY_URL = 'https://shogo-ota.github.io/chord-palette-iOS-policy/privacy.html';

/** Support / contact page (App Store Connect "Support URL"). */
export const SUPPORT_URL = 'https://shogo-ota.github.io/chord-palette-iOS-policy/support.html';
