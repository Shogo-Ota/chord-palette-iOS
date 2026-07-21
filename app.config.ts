import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config: inherits the static `app.json` and injects client-safe secrets
 * into `extra` from `EXPO_PUBLIC_*` environment variables at build time (EAS `env` or
 * EAS secrets). Values fall back to whatever `app.json` holds (empty by default), so a
 * misconfigured build ships with empty keys — which the app degrades safely on:
 *   - billing → DisabledBillingProvider (no free unlock, purchases fail clearly),
 *   - Sentry / PostHog → disabled (no crash reporting / analytics).
 *
 * `src/lib/env.ts` reads these values through `Constants.expoConfig.extra`.
 * No secret is ever committed to the repo — real values live only in EAS.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = (config.extra ?? {}) as Record<string, unknown>;
  return {
    ...(config as ExpoConfig),
    extra: {
      ...extra,
      posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? extra.posthogKey ?? '',
      posthogHost:
        process.env.EXPO_PUBLIC_POSTHOG_HOST ?? extra.posthogHost ?? 'https://us.i.posthog.com',
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? extra.sentryDsn ?? '',
      revenueCatIosKey:
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? extra.revenueCatIosKey ?? '',
      convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? extra.convexUrl ?? '',
      clerkPublishableKey:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? extra.clerkPublishableKey ?? '',
    },
  };
};
