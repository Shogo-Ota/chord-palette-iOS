# src/services

外部SaaS・プラットフォームAPIを抽象化する層。差し替え可能なインターフェイスを提供する。

想定サービス: `billing/`(RevenueCat) `analytics/`(PostHog) `monitoring/`(Sentry) `auth/`(Clerk) `backend/`(Convex client) `storage/`(R2署名URL経由) `notifications/`(Expo Push)

ルール: 画面・featureからSDKを直接呼ばず、必ずこの層のインターフェイス経由にする。クライアントの権限判定を最終的な真実にしない（サーバー側で再検証）。
