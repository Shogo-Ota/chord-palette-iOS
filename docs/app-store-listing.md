# App Store 提出メタデータ / プライバシー（Chord Palette v1.0）

対象: iOS / App Store Connect（言語: 日本語プライマリ）
最終更新: 2026-07-21
関連: `docs/release-plan.md`（M5/M6）、`Chord_Palette_iOS_MVP_Requirements_v1.md`

> 本書は提出用テキストのドラフト。`[要ユーザー]` はユーザーが用意/確定する項目。

---

## 1. 基本情報

| 項目 | 値 |
|---|---|
| App 名（表示名, 30字以内） | コードパレット |
| サブタイトル（30字以内） | コード進行を作って動画に |
| Bundle ID | `app.chordpalette` |
| バージョン | 1.0.0 |
| プライマリカテゴリ | ミュージック |
| セカンダリカテゴリ（任意） | エンターテインメント |
| 年齢制限 | 4+（不適切コンテンツなし） |
| 価格 | 無料（App内課金: Palette Pro 月額 ¥500 自動更新） |

## 2. キーワード（100字以内・カンマ区切り、日本語）

```
コード進行,作曲,音楽理論,ダイアトニック,弾き語り,ピアノ,伴奏,コード,和音,DTM,ソングライティング,ループ,動画
```

## 3. プロモーションテキスト（170字以内・審査なしで更新可）

```
思いついたコード進行を、その場で鳴らして・並べて・縦動画に。ダイアトニックから高度なコードまで、キー変更もワンタップ。作った進行はSNS映えする動画にして共有できます。
```

## 4. 説明文（4000字以内）

```
コードパレットは、コード進行づくりに集中できるiPhone向けの作曲アプリです。ログイン不要、開いてすぐに音が鳴ります。

■ すぐ鳴る・すぐ作れる
・Cメジャーのダイアトニックコードを候補から選ぶだけ（無料）
・三和音／7thの切り替え、sus4・add9などにも対応
・最大16小節、コードの長さは1小節・1/2・1/4から選択

■ 本格的な伴奏サウンド
・グランドピアノ／エレクトリックピアノの実音源で試聴
・ブロック／アルペジオ／8ビート／16ビート／シャッフル／スウィング／ボサノバ／レゲエ／ワルツなど13種のリズム（すべて無料）
・8ビート／16ビート／クラップ／ボサノバのドラムグルーヴを重ねてループ再生

■ すぐ使える進行プリセット
・王道進行／ポップパンク進行／切ないループを収録（無料）
・選ぶだけで編集画面に読み込まれ、そのまま続きを作れます

■ 縦動画で共有
・作ったコード進行を9:16の縦動画に書き出し
・再生中のコードと鍵盤ハイライトが同期
・カメラロール保存、共有シートからSNSへ

■ Palette Pro（月額 ¥500・自動更新）
・9th／11th／13th／オルタードなどのテンション、6th、借用和音、セカンダリードミナント、オンコード
・全12メジャーキーへのキー変更・移調（度数を保ったままトランスポーズ）※無料はCメジャー
・Pro専用の進行プリセット（王道アレンジ／おしゃれ循環／シティポップ循環／泣きの借用／下降ベースライン）
・いつでも解約可能。購入の復元にも対応

コードの引き出しを増やしたい人、弾き語りやDTMのアイデア出しをしたい人に。
```

## 5. サブスクリプション（App内課金）

| 項目 | 値 |
|---|---|
| 参照名（内部） | Palette Pro Monthly |
| 製品ID | `palette_pro_monthly` |
| RevenueCat entitlement | `palette_pro` |
| 種別 | 自動更新サブスク（Subscription Group 内・月額のみ） |
| 価格 | ¥500 / 月 |
| 表示名（ローカライズ） | Palette Pro |
| 説明（ローカライズ） | 高度なコードと本格プリセットを解放する月額プラン。いつでも解約できます。 |

- 課金は RevenueCat 経由（[src/services/billing/RevenueCatBillingProvider.ts](../src/services/billing/RevenueCatBillingProvider.ts)）。
- App Store Connect のサブスク商品を「提出準備完了」にし、初回審査ではアプリと同時に審査に出す。
- 契約/税務/銀行情報が «有効» であること（未設定だと商品が取得できず審査で落ちる）。
- 利用規約は Apple 標準 EULA を使用（`src/config/legal.ts`）。プライバシーポリシーは上記 §7 の公開URLを ASC の「App のプライバシーポリシー URL」に設定。

## 6. App Privacy（データ収集の申告）

方針: 個人特定情報・ユーザー生成コンテンツ（曲名/メモ/コード進行/動画）は一切収集・送信しない（要件§5.12）。

| データ種別 | 収集 | 用途 | 個人と紐付け | トラッキング |
|---|---|---|---|---|
| クラッシュデータ / 診断（Sentry） | あり | アプリ機能（不具合の検知・修正） | いいえ | いいえ |
| 利用状況データ / 製品操作（PostHog・匿名） | あり | 分析・アプリ機能改善 | いいえ | いいえ |
| それ以外（連絡先/位置/購入履歴/検索履歴 等） | なし | - | - | - |

- Sentry は `sendDefaultPii: false`・`tracesSampleRate: 0`（[src/services/monitoring/index.ts](../src/services/monitoring/index.ts)）。
- PostHog は匿名イベントのみ（[src/services/analytics/index.ts](../src/services/analytics/index.ts)）。ログイン/個人情報なし、匿名 distinctId 中心。送信イベントは要件§9 の18種に型で制限し、曲名/メモ/コード進行/動画は送らない（本書 §6a）。
- App Store Connect の App Privacy では「使用状況データ → 製品操作（Product Interaction）」を **「トラッキングに使用しない」「個人と紐付けない」** で申告。
- 課金の取引は Apple / RevenueCat 側で処理。アプリ独自に購入履歴を保存・送信しない。

### 6a. 送信する分析イベント（匿名・非PII）

`app_opened` / `project_created` / `preset_selected` / `chord_added` / `chord_removed` / `chord_duration_changed` / `playback_started` / `groove_selected` / `instrument_selected` / `export_duration_selected` / `video_export_started` / `video_export_completed` / `video_export_failed` / `paywall_viewed` / `palette_pro_purchase_started` / `palette_pro_purchased` / `palette_pro_purchase_failed` / `purchase_restored`

- 付随プロパティは安全なメタデータのみ（例: groove/instrument の id、コード数、書き出し秒数、成否）。

## 7. 提出物・URL（`[要ユーザー]`）

| 項目 | 状態 |
|---|---|
| プライバシーポリシー URL | `https://shogo-ota.github.io/chord-palette-iOS-policy/privacy.html`（公開済み） |
| サポート URL | `https://shogo-ota.github.io/chord-palette-iOS-policy/support.html`（公開済み） |
| マーケティング URL（任意） | 未設定（任意・空欄でも可） |
| App アイコン（1024×1024, 透過なし） | `assets/icon/app-store-icon-1024.png`（`assets/icon/app-icon.png` と同一。角丸・文字なしの全面塗り） |

### スクリーンショット（必須: 6.7"インチ = 1290×2796px, 最低1枚・推奨3〜5枚）

推奨カット（実機/シミュレータで撮影 → Figma等で軽く装飾可）:
1. エディタ: コード候補＋進行ストリップ（メイン価値）
2. 再生中: 鍵盤ハイライト＋伴奏/グルーヴ選択
3. キー変更/長さ切替などの操作
4. 動画書き出し画面（縦動画プレビュー・ウォーターマーク）
5. Palette Pro（paywall）

- 6.5"（1242×2688）は任意。6.7" があれば自動流用されるため 6.7" を優先。
- iPad は非対応（`supportsTablet:false`）なので不要。

## 8. 審査メモ（App Review Information → Notes）

```
・ログイン不要。起動後すぐにコード進行の作成・再生が可能です。
・Palette Pro は月額自動更新サブスク（¥500/月）です。Sandbox アカウントで購入・復元をご確認ください。
・キー変更（Cメジャー以外）と高度なコード、Proプリセットは Palette Pro の対象です。無料版はCメジャーで作曲できます。
・「進行プリセット」画面に無料プリセット3件とProプリセット5件があります。無料版でもProプリセットの試聴（再生のみ）が可能です。
・録音やマイクは使用しません。写真ライブラリへのアクセスは、書き出した動画をカメラロールへ保存する目的のみに使用します。
```

- 連絡先: Shogo Ota / shogoota07@gmail.com（電話は ASC の連絡先に登録済みのもの）
- デモアカウント: 不要（ログインなし）

## 9. 輸出コンプライアンス

- 非対称暗号の独自利用なし → `ITSAppUsesNonExemptEncryption: false`（[app.json](../app.json)）設定済み。追加の CCATS 不要。

## 10. 提出前チェック（要点）

- [ ] EAS 環境変数 `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_POSTHOG_KEY`（必要なら `EXPO_PUBLIC_POSTHOG_HOST`）を production/preview に設定
- [ ] ASC サブスク商品 `palette_pro_monthly` が「提出準備完了」／契約・税務・銀行 «有効»
- [ ] RevenueCat の Offering(current) に月額パッケージ・entitlement `palette_pro` を紐付け
- [ ] プライバシーポリシー/サポートURL を公開
- [ ] スクショ（6.7"）・アイコン・説明文・キーワードを登録
- [ ] App Privacy を「クラッシュ診断のみ」で申告
- [ ] preview ビルドで Sandbox 購入/復元/解約反映を実機確認
- [ ] `docs/release-plan.md` §2 の DoD を実機リグレッション
```
