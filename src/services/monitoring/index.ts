import { env } from '@/lib/env';

/**
 * Crash / error monitoring service (Sentry).
 *
 * A thin abstraction so the app never imports Sentry directly. `@sentry/react-native`
 * is loaded via `require` *inside* `initMonitoring` so the native SDK never enters the
 * dev/Metro or jest module graph — monitoring is a no-op in development and in tests.
 *
 * Privacy (requirements §5.12): only crash/error diagnostics are sent. We never attach
 * project titles, memos, chord progressions, or exported video content, and PII is off.
 */

type SentryModule = typeof import('@sentry/react-native');
type LogContext = Record<string, unknown>;

let sentry: SentryModule | null = null;
let enabled = false;

/**
 * Initialize monitoring once at app startup. No-op in dev builds and when no DSN is
 * configured, so telemetry only runs in configured store builds. Never throws.
 */
export function initMonitoring(): void {
  if (__DEV__ || !env.sentryDsn) return;
  try {
    // Lazy load: keeps the native SDK out of the dev/Metro and jest module graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/react-native') as SentryModule;
    sentry.init({
      dsn: env.sentryDsn,
      // Crash + error reporting only — no performance tracing by default (cost/privacy).
      tracesSampleRate: 0,
      // Do not attach IP/user identifiers or request bodies.
      sendDefaultPii: false,
    });
    enabled = true;
  } catch {
    sentry = null;
    enabled = false;
  }
}

/** Report a handled error/message to Sentry. No-op unless monitoring is initialized. */
export function captureError(message: string, context?: LogContext): void {
  if (!enabled || !sentry) return;
  try {
    sentry.captureMessage(message, { level: 'error', extra: context });
  } catch {
    // Monitoring must never throw into application code.
  }
}
