import Constants from 'expo-constants';

/**
 * Typed, centralized access to client-safe environment config.
 * Values are injected in `app.config.ts` via `extra` and read here through
 * expo-constants. Never read `process.env` directly from feature/UI code.
 */
export type AppEnv = {
  posthogKey: string;
  posthogHost: string;
  sentryDsn: string;
  revenueCatIosKey: string;
  convexUrl: string;
  clerkPublishableKey: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppEnv>;

export const env: AppEnv = {
  posthogKey: extra.posthogKey ?? '',
  posthogHost: extra.posthogHost ?? 'https://us.i.posthog.com',
  sentryDsn: extra.sentryDsn ?? '',
  revenueCatIosKey: extra.revenueCatIosKey ?? '',
  convexUrl: extra.convexUrl ?? '',
  clerkPublishableKey: extra.clerkPublishableKey ?? '',
};

/** Read a required env value, throwing a clear error when it is missing. */
export function requireEnv<K extends keyof AppEnv>(key: K): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment value: ${key}`);
  }
  return value;
}
