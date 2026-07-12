import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Static values continue to live in `app.json`; this file
 * layers in environment-driven `extra` values so the client can read config via
 * `expo-constants` (see `src/lib/env.ts`).
 *
 * Only client-safe (EXPO_PUBLIC_*) values are injected here. Secret keys must
 * never be placed in the client bundle.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Chord Palette',
  slug: config.slug ?? 'chord-palette',
  extra: {
    ...config.extra,
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? '',
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  },
});
