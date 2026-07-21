# Sprint 8 — PostHog PMF 計測レイヤー（分析基盤の有効化）

作成日: 2026-07-20 / マイルストーン: M4（分析）/ 分析設計: `docs/analytics/pmf-signals.md`
仕様の正: `Chord_Palette_iOS_MVP_Requirements_v1.md` §5.12 / §10.5

---

## 0. コーディネーション記録（重複作業防止 — 必読）

> ⚠️ **§5.12 の送信イベント18種は sprint-7 で全て配線済み。再配線・再実装は禁止。**
> 本スプリントは「イベントを PMF として読めるようにする土台（設定有効化＋プロパティ拡張）」だけを追加する。

既存配線（変更しないこと。壊れていないか確認するのみ）:

| イベント | 配線箇所 |
|---|---|
| app_opened | `src/app/_layout.tsx:49` |
| project_created | `src/app/index.tsx:74` |
| preset_selected | `src/app/presets.tsx:65` |
| chord_added | `src/app/editor.tsx:346` |
| chord_removed | `src/app/editor.tsx:881` |
| chord_duration_changed | `src/app/editor.tsx:640, 886` |
| playback_started | `src/app/editor.tsx:303` |
| groove_selected | `src/app/groove.tsx:338, 354` |
| instrument_selected | `src/app/groove.tsx:307` |
| export_duration_selected | `src/app/export.tsx:93` |
| video_export_started/completed/failed | `src/app/export.tsx:94, 102, 108` |
| paywall_viewed | `src/app/paywall.tsx:61` |
| palette_pro_purchase_started/purchased/purchase_failed | `src/services/billing/index.ts:164, 168, 170, 176` |
| purchase_restored | `src/services/billing/index.ts:186` |

既存の service 抽象 `src/services/analytics/index.ts`（`initAnalytics` / `track`）、`src/lib/env.ts`（posthogKey/Host）、`app.config.ts`（extra 注入）も実装済み。→ **拡張のみ**。

---

## 1. ゴール

`docs/analytics/pmf-signals.md` の計測（North Star / アクティベーション / リテンション / マネタイズ）を **実データで取れる状態**にする。具体的には、リテンションとセグメンテーションを成立させる **super/person プロパティ** を送出し、PostHog を **有効化可能**にする。

---

## 2. 実装タスク（@generator）

責務範囲: `src/services/analytics/index.ts` の拡張、`src/services/billing/index.ts` からの1点配線、設定ファイル/ドキュメント。**画面・音楽ロジック・既存イベントには触れない。**

### G1. Super properties の登録
`initAnalytics()` 内で、PostHog クライアント生成後に super properties を登録する（`posthog-react-native` v4 の `register` 相当）:
- `app_version` — `expo-application` の `nativeApplicationVersion`（無ければ `expo-constants` の version）
- `build_profile` — `preview` | `production`（`expo-constants` の `extra`/リリースチャネル等から解決。判別不能時は `'production'` を既定に）
- `platform` — `'ios'`

制約: **`__DEV__` / 空キー時は従来どおり完全 no-op**（SDK を dev/Metro・jest のモジュールグラフに載せない `require` 遅延ロードを維持）。super props 取得に失敗しても throw しない。

### G2. Person properties（セグメント）API と配線
`src/services/analytics/index.ts` に追加する公開 API:
- `setUserSegment(props: { isPro?: boolean })` — `is_pro` を person property（`$set`）として送る。未初期化/no-op 時は何もしない。never throw。
- `setInstallCohortOnce()`（または init 内で実施）— `install_week`（`YYYY-Www` 形式）を `$set_once`。

配線:
- `src/services/billing/index.ts` の `wireProvider` のエンタイトルメント変化コールバック（`onEntitlementsChange`）と初期解決時に `setUserSegment({ isPro: entitlements.palettePro })` を呼ぶ。billing→analytics は service 間依存として許容（画面を経由しない）。
- `install_week` は `initAnalytics()` 内で1回 `$set_once`。

> 匿名方針（§10.5）維持: `identify` によるログインはしない。distinctId は PostHog の匿名 ID のまま。person property は「匿名 ID に紐づく属性」を付けるだけ。

### G3. PostHog 有効化の設定・ドキュメント
- `.env.example`: 「Not used in v1」だった PostHog 行を**有効化**（コメントアウト解除）し、`phc_...` が **クライアント公開キー**であること、EAS env 手順を追記（RevenueCat/Sentry と同様の書式）。
- `app.config.ts` / `src/lib/env.ts` は対応済み → 変更不要（確認のみ）。
- 実際のキー値はコミットしない（`.env` は gitignore、EAS env はユーザーが設定）。

### G4.（任意）イベント props の微追記
- `src/app/export.tsx` の `video_export_completed` に `chords: s.progression.length` を追加してよい（低リスク・進行内容そのものは送らない）。無理はしない。

### 非対象（やってはいけない）
- 18イベントの再配線・改名・新規イベント追加（契約外イベント禁止）。
- 画面 UI / 音楽・オーディオ・Data Model の変更。
- 実キーのコミット、`identify`（実名/ログイン）導入、PII 送信。

---

## 3. 受け入れ基準（@evaluator）

- [ ] `npx tsc --noEmit` / `jest`（既存 pass 数を維持）/ `expo lint` すべて OK。
- [ ] 既存18イベントの `track(...)` 呼び出しが**無改変**（差分は追加のみ、既存行を壊さない）。
- [ ] `setUserSegment` が billing のエンタイトルメント変化・初期化で呼ばれる。
- [ ] `__DEV__` / 空キー環境で analytics が完全 no-op（jest のモジュールグラフに `posthog-react-native` が入らない＝テスト汚染なし）。
- [ ] 追加プロパティが **匿名・非PII** のみ（app_version / build_profile / platform / is_pro / install_week / counts）。タイトル/メモ/具体進行/動画を送っていない（§5.12・§10.5）。
- [ ] `.env.example` と関連 docs が PostHog 有効化手順を反映。
- [ ] `docs/analytics/pmf-signals.md` の §7 配線マップ・§8 プロパティ定義と実装が一致。
- [ ] never-throw: analytics 由来の例外がアプリ本体に伝播しない（try/catch 維持）。

不合格時: 機能不具合 → @generator へ差し戻し。合格まで反復。

---

## 4. 完了後（main）

- `docs/release-plan.md` の M4 進捗に「PostHog PMF 計測レイヤー実装済み・キー投入待ち」を追記。
- ユーザーへ: PostHog Project API Key の `.env` / EAS env 投入と、pmf-signals.md §9 のダッシュボード構築を依頼。
