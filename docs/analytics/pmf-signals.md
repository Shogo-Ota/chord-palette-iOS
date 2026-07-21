# PMF シグナル計測設計（PostHog）

作成日: 2026-07-20 / 作成: main（オーケストレータ） / 実装契約: `docs/sprints/sprint-8-analytics-pmf.md`
仕様の正: `Chord_Palette_iOS_MVP_Requirements_v1.md` §5.12（アナリティクス）/ §10.5（プライバシー）

> このドキュメントは **「Chord Palette が PMF（Product/Market Fit）を達成したかどうか」を PostHog の行動データから判定する**ための計測設計・North Star・ファネル・ダッシュボード定義をまとめた**分析リファレンス**。
> 送信イベント自体（18種）は sprint-7 で既に全て配線済み（→ §7 配線マップ）。本書はそれらを **どう読むか** と、PMF 判定に必要な **プロパティ拡張** を定義する。

---

## 1. プロダクトの価値仮説（何が刺されば PMF か）

Chord Palette のコア価値: **「ログイン不要で、コード進行を素早くスケッチし → 鳴らして確かめ → 縦動画にして共有する」**。

したがって価値実現の深さは次の順で深くなる:

1. **作る** — `chord_added` / `project_created`（進行を組む）
2. **聴く（Light aha）** — `playback_started`（自分の進行が鳴る＝最初の "おっ"）
3. **仕上げて共有（Core aha）** — `video_export_completed`（保存/共有できる成果物になる＝価値の完全実現＋成長ループの起点）
4. **課金（支払い意思＝価値の裏付け）** — `palette_pro_purchased`

PMF とは「価値仮説がリテンションとして現れる」こと。よって計測の中心は **リテンション**、成果指標は **North Star（週次 exporters）**、その手前の律速が **アクティベーション（aha 到達率）** となる。

---

## 2. North Star Metric（NSM）

**NSM = 週あたり `video_export_completed` を 1 回以上行ったユニークユーザー数（Weekly Exporters）。**

- 選定理由: 書き出し＝価値の完全実現。かつ縦動画は SNS 共有され新規流入を生む**成長ループの起点**。
- 補助 NSM: 週あたり `playback_started` ≥ 1 のユニークユーザー（＝自分の進行を「聴いた」人）。書き出しより手前の広いコア価値。
- 反北極星（vanity 指標として単独では見ない）: DL 数、`app_opened` 数、総イベント数。

---

## 3. アクティベーション（aha moment）

| レベル | 定義イベント | 意味 |
|---|---|---|
| Light aha | 初回 `playback_started` | 自分の進行が鳴る体験 |
| Core aha | 初回 `video_export_completed` | 共有可能な成果物の完成 |

**アクティベーション・ファネル**（新規ユーザーの初回セッション or D0–D1 窓）:

```
app_opened → (project_created | chord_added) → chord_added×2+ → playback_started → video_export_completed
```

- 計測: PostHog Funnel。新規（`install_week` コホート）で分解。
- 暫定目標（PMF 初期シグナルの当たり；実データで再校正する）:
  - 初回セッションで **playback_started 到達 ≥ 40%**
  - 初回セッションで **video_export_completed 到達 ≥ 15%**
- ドロップ分析: どのステップで最も落ちるか＝オンボーディング改善の投資先。

---

## 4. リテンション（最重要の PMF シグナル）

- **定義**: PostHog Retention。起点＆対象イベント = `playback_started`（コア価値行動）、**週次コホート**。
- **PMF 判定**: リテンションカーブが **フラット化（下げ止まり）** するか。
  - ✅ PMF シグナルあり: W1 以降で一定割合が残り、W4→W8 でカーブが平ら（"smile/flatten"）。
  - ❌ PMF 未達: 単調減衰でゼロに漸近。
- **セグメント分解**（Breakdown）: `is_pro`（有料/無料）、`install_week`、アクティベーション到達有無、`app_version`。
  - 例: 「Core aha 到達者のリテンション」対「未到達者」を比較 → aha の因果的重要度を可視化。
- 補助: `app_opened` 起点の粗いリテンションも見るが、判定の主は **コア行動リテンション**。

---

## 5. エンゲージメント（コアループの回転）

- セッションあたり `chord_added` 数、`playback_started` 数。
- DAU/WAU 比（スティッキネス）。
- `project_created` の反復率（複数プロジェクトを作る＝継続利用シグナル）。
- パターン探索の幅: `groove_selected` / `instrument_selected` のユニーク種類数（機能の探索＝定着の先行指標）。

---

## 6. マネタイズ・ファネル（支払い意思＝価値の裏付け）

```
paywall_viewed → palette_pro_purchase_started → palette_pro_purchased
```

- 無料→Pro 転換率、`paywall_viewed` の発生源（Pro プリセット／高度コードのどちらが引き金か）。
- `purchase_restored` 率、`palette_pro_purchase_failed` の `reason` 分布（決済摩擦の検出）。
- PMF 観点: 早期に自然発生する課金は「価値が金銭に変換される」強いシグナル。

---

## 7. イベント → シグナル対応表（全18イベント・配線済み）

| イベント | 既存 props | 主に効く PMF 指標 | 配線箇所（sprint-7 実装済み） |
|---|---|---|---|
| `app_opened` | — | ファネル起点 / 粗リテンション | `src/app/_layout.tsx` |
| `project_created` | — | エンゲージ / 反復利用 | `src/app/index.tsx` |
| `preset_selected` | category, chords | アクティベーション補助 | `src/app/presets.tsx` |
| `chord_added` | category, count | 作る（コアループ） | `src/app/editor.tsx` |
| `chord_removed` | — | 編集エンゲージ | `src/app/editor.tsx` |
| `chord_duration_changed` | beats | 編集エンゲージ | `src/app/editor.tsx` |
| `playback_started` | chords, loop | **Light aha / リテンション起点** | `src/app/editor.tsx` |
| `groove_selected` | groove | 探索エンゲージ | `src/app/groove.tsx` |
| `instrument_selected` | instrument | 探索エンゲージ | `src/app/groove.tsx` |
| `export_duration_selected` | durationSec | 書き出し前段 | `src/app/export.tsx` |
| `video_export_started` | kind, durationSec | 書き出しファネル | `src/app/export.tsx` |
| `video_export_completed` | kind, durationSec | **Core aha / NSM** | `src/app/export.tsx` |
| `video_export_failed` | kind | 摩擦検出 | `src/app/export.tsx` |
| `paywall_viewed` | — | マネタイズ・ファネル | `src/app/paywall.tsx` |
| `palette_pro_purchase_started` | productId | マネタイズ・ファネル | `src/services/billing/index.ts` |
| `palette_pro_purchased` | productId | **課金コンバージョン** | `src/services/billing/index.ts` |
| `palette_pro_purchase_failed` | reason | 決済摩擦 | `src/services/billing/index.ts` |
| `purchase_restored` | productId | 復元 | `src/services/billing/index.ts` |

---

## 8. PMF 判定に必要なプロパティ拡張（＝ sprint-8 の実装対象）

イベント配線は完了しているが、**リテンションとセグメンテーションを成立させる土台**が未実装。これが本書に紐づく実装契約の中身。

### 8.1 Super properties（`register` — 全イベントに自動付与）
- `app_version` — アプリバージョン（`expo-application` / `expo-constants`）
- `build_profile` — `preview` | `production`（ビルドチャネル識別）
- `platform` — `"ios"` 固定

### 8.2 Person properties（`$set` — 人単位でリテンションを分解）
- `is_pro`（boolean）— エンタイトルメント状態。**変化時に更新**（無料↔Pro のリテンション比較に必須）
- `install_week`（`$set_once`）— 初回起動週（`YYYY-Www`）。install コホートの基準

> PostHog は匿名 distinctId と first-seen を自動保持するため、identify によるログインは行わない（§10.5 匿名方針）。person property は「ログインなしで人に紐づく属性」を付けるためだけに使う。

### 8.3 イベント props の追記（任意・低リスク）
- `video_export_completed` に `chords`（進行長）を追加 → 書き出し内容のボリューム分析。

### 8.4 プライバシー制約（§5.12 / §10.5）— 追加プロパティも遵守
送ってよいのは **id / 数値カウント / 真偽フラグ / バージョン文字列** のみ。
**禁止**: プロジェクトのタイトル・メモ本文・具体的なコード進行（コード名の並び）・生成動画そのもの。

---

## 9. PostHog に作るインサイト / ダッシュボード

「PMF Signals」ダッシュボードに以下を配置する。

1. **Activation Funnel** — `app_opened → chord_added → playback_started → video_export_completed`（新規 `install_week` で breakdown）
2. **Core Retention** — Retention, 起点/対象 `playback_started`, 週次, breakdown `is_pro`
3. **North Star Trend** — Trends, 週次ユニークユーザー where `video_export_completed`（+ `playback_started` 補助線）
4. **Monetization Funnel** — `paywall_viewed → palette_pro_purchase_started → palette_pro_purchased`
5. **Engagement** — Trends: `chord_added` / user, `playback_started` / user, DAU/WAU
6. **Quality/Friction** — `video_export_failed` 率、`palette_pro_purchase_failed` の `reason` breakdown
7. **Segment overlay** — 主要インサイトを `is_pro` / `app_version` で breakdown

---

## 10. PMF 総合判定の読み方（意思決定ルール）

PMF 到達を示す複合シグナル（同時に満たすほど確度が上がる）:

1. **コア行動リテンションのフラット化**（§4）— 最重要。
2. **NSM（週次 exporters）の自然増**（§2）— 追加獲得なしで右肩上がり。
3. **アクティベーション率の上昇/高止まり**（§3）。
4. **無料→有料転換の自然発生**（§6）。

いずれも未達なら「価値仮説の再検討 or オンボーディング/コア体験の改善」に戻る。
（定性 PMF: Sean Ellis 「無くなったら非常に残念 ≥ 40%」アンケートは将来 PostHog Survey で計測予定。本フェーズはスコープ外。）

---

## 11. 前提: PostHog 有効化（ユーザー作業）

イベントは実装済みだが、**キー未設定のため現状は no-op**（`initAnalytics` は `__DEV__` と空キーで送信しない設計）。有効化には PostHog の **Project API Key（`phc_...`、クライアント公開可）** を設定する:

- ローカル: `.env` に `EXPO_PUBLIC_POSTHOG_KEY=phc_xxx`（`.env` は gitignore 済み）
- EAS ビルド:
  ```
  eas env:create --name EXPO_PUBLIC_POSTHOG_KEY --value phc_xxx \
    --environment production --environment preview --visibility sensitive
  ```
- ホストが US 以外なら `EXPO_PUBLIC_POSTHOG_HOST` も設定（既定 `https://us.i.posthog.com`）。
