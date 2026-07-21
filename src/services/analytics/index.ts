import { env } from '@/lib/env';

/**
 * Anonymous product analytics service (PostHog).
 *
 * A thin abstraction so the app never imports PostHog directly. `posthog-react-native`
 * is loaded via `require` *inside* `initAnalytics` so the SDK never enters the
 * dev/Metro or jest module graph — analytics is a no-op in development and in tests.
 *
 * Privacy (requirements §5.12 / §10.5): events are anonymous (PostHog's random
 * distinctId, no login/PII). We NEVER send project titles, memos, concrete chord
 * progressions, or exported video content — only safe interaction metadata (ids,
 * counts, durations). The allowed event names are constrained by {@link AnalyticsEvent}.
 */

/** The exhaustive set of analytics events (requirements §9 送信イベント). */
export type AnalyticsEvent =
  | 'app_opened'
  | 'project_created'
  | 'preset_selected'
  | 'chord_added'
  | 'chord_removed'
  | 'chord_duration_changed'
  | 'playback_started'
  | 'groove_selected'
  | 'instrument_selected'
  | 'export_duration_selected'
  | 'video_export_started'
  | 'video_export_completed'
  | 'video_export_failed'
  | 'paywall_viewed'
  | 'palette_pro_purchase_started'
  | 'palette_pro_purchased'
  | 'palette_pro_purchase_failed'
  | 'purchase_restored';

/** Safe, non-PII event properties (ids / counts / durations / flags only). */
export type AnalyticsProps = Record<string, string | number | boolean>;

type PostHogModule = typeof import('posthog-react-native');
type PostHogClient = InstanceType<PostHogModule['default']>;

let client: PostHogClient | null = null;
let enabled = false;

/**
 * Initialize analytics once at app startup. No-op in dev builds and when no key is
 * configured, so telemetry only runs in configured store builds (preview/production).
 * Never throws.
 */
export function initAnalytics(): void {
  if (__DEV__ || !env.posthogKey) return;
  try {
    // Lazy load: keeps the SDK out of the dev/Metro and jest module graph.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PostHog = (require('posthog-react-native') as PostHogModule).default;
    client = new PostHog(env.posthogKey, { host: env.posthogHost });
    enabled = true;
  } catch {
    client = null;
    enabled = false;
  }
}

/**
 * Record an anonymous product event. No-op unless analytics is initialized. Callers
 * must pass only non-PII metadata (never titles/memos/progressions/video content).
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!enabled || !client) return;
  try {
    client.capture(event, props);
  } catch {
    // Analytics must never throw into application code.
  }
}
