# Sprint 5 — 課金 & Pro コンテンツ（M3 / Mock 先行）実装カード

正典: `Chord_Palette_iOS_MVP_Requirements_v1.md`（特に §5.7 音色 / §5.8 プリセット / §5.11 課金 / §5.12 アナリティクス / §10.4）＋ 本カード。
前提: M1 オーディオ（伴奏4＋ドラム7＋度数テンション）／ M2 動画書き出しは `master` に統合済み・検証済み（`tsc` / `jest` 90 pass / `expo lint` OK）。Pro ゲート自体は `src/lib/entitlements.ts` の `isLocked()` 経由で概ね動作（ロック表示・paywall 遷移あり）だが、**購入・復元の実処理が未配線**（`src/app/paywall.tsx` の購入ボタンに `onPress` 無し、`src/services/billing/index.ts` に purchase/restore 無し）。本スプリントの主眼はここ。

> **商品モデル（2026-07-18 ユーザー決定）**: Palette Pro は **月額サブスクリプション（自動更新・月額のみ・¥490/月）**。当初の「買い切り（非消費型¥490）」から変更。要件 §5.11 も同決定に合わせて更新済み。App Store Connect 上は **Subscription Group 内の月額プロダクト**として作成する（種別=Auto-Renewable Subscription）。
> M3 は **Mock 先行**の二段構え。**5A（Provider 抽象＋Mock 購入/復元＋paywall 配線）を本スプリントの実装対象**とし、**5B（実 RevenueCat 差し替え）は方針のみ記載**（APIキー / App Store Connect サブスクプロダクトが用意でき次第、別スプリントで着手・EAS 再ビルド必須）。
> 本スプリントは **TypeScript のみの変更**が中心で、ネイティブ追加を伴わない（Mock 実装のため）。したがって Metro 反映で実機確認できる。実 RevenueCat（`react-native-purchases`）を足すのは 5B。

---

## 0. 確定した方針（引き継ぎ `docs/handoff-m3.md` §2 ＋ 2026-07-18 商品モデル決定）

- **商品モデル = 月額サブスク（自動更新・月額のみ・¥490/月）**。当初の買い切り（非消費型）から変更。Mock 先行の方針は不変（Provider 抽象＋Mock 購入/復元＋paywall 配線）。
- **RevenueCat の APIキー / App Store Connect のサブスクプロダクト（Palette Pro ¥490/月）はまだ無い前提**。まず「課金の **Provider 抽象（Strategy / Provider パターン）** ＋ **Mock 購入/復元** ＋ **paywall 配線**（サブスク登録→entitlement 解放→ロック解除、復元）」を実装する。
- 実 `react-native-purchases` は後日 APIキー / サブスクプロダクト用意後に **Provider 差し替えのみ**で対応（画面・ドメインは不変。5B で EAS 再ビルド必須）。**買い切り→サブスクの商品モデル変更も、この Provider 抽象の内側で吸収**する（`BillingProvider` の契約は購入形態に依存しない）。
- **層分離を厳守**: 課金は必ず **Service 経由**。画面コンポーネント（`paywall.tsx` / `editor.tsx` / `presets.tsx`）に `Purchases` や購入ロジックを直書きしない。
- **entitlement の意味**: サブスクが**有効中**の間だけ `palettePro=true`（＝Pro 解放）。**失効/解約で `palettePro=false` に戻る**。5A の Mock では「有効/失効」を切り替えられるようにし、実 RevenueCat（5B）では customerInfo の active entitlement を同じ `Entitlements` にマッピングする（抽象は不変）。
- **クライアント申告を信用しない設計**は Phase 4（Convex サーバ検証）で恒久化する前提。サブスクの有効性はストア／サブスク基盤が正典であり、本スプリントの Mock/ローカル entitlement は暫定である旨をコードヘッダとドキュメントに明記する。
- **価格表示**はストア取得のローカライズ済み価格を優先（§5.11）。Mock 段階では `product.priceString`（例: `¥490`）＋期間 `/月` を Provider が返し、paywall はハードコードせず Provider の値を **「¥490 / 月」の期間付き**で表示する。サブスクである旨（自動更新・いつでも解約可能）も明記する。
- **Pro プリセットの追加**（丸サ / Just The Two of Us / Pop Punk / 小室 / City Pop）は度数ベースのデータ定義として実装（§5.8）。**プリセット名の法務リネームは M5 で実施**（本スプリントでは仮称のまま。ただしデータ定義は `presetCatalog` に集約し、後からリネームが1箇所で済む構造にする）。
- **Pro 音色（アコギ / エレキ / ストリングス）は V2 送り**（`docs/release-plan.md` §5-1 の推奨に従う）。本スプリントでは UI 上のロック表示にとどめ、購入後も音色は解放しない（音源未実装のため）。Pro の価値は「高度コード＋Pro プリセット」に集約する。

---

## 1. 5A と 5B の境界

### Phase 5A（本スプリントの実装対象）
- **課金 Provider 抽象**（`BillingProvider` インターフェース）: `getOfferings` / `purchasePro` / `restore` / `getEntitlements` / `onEntitlementsChange` を定義。
- **`MockBillingProvider`**: メモリ上でサブスク購入・復元をシミュレート（`purchasePro` でサブスク有効化＝`palettePro=true` に遷移、`restore` で復元、失敗注入、**失効/解約による `palettePro=false` への切り戻し**もできる）。
- **`billingService`（Service 層）**: Provider を注入（DI）して保持し、画面には Provider 具象型を露出しない。既存 `useEntitlements()` / `getEntitlements()` を Provider の状態と同期。
- **paywall 配線**（`src/app/paywall.tsx`）: 購入ボタン `onPress` → `billingService.purchasePro()`（サブスク登録）→ 成功で entitlement 解放 → paywall を閉じる。復元ボタン → `billingService.restore()`。価格は「¥490 / 月」の期間付き表示＋サブスク文言（自動更新・いつでも解約可能）。処理中ローディング / 失敗トースト / 成功フィードバック。
- **ロック解除の反映**: 購入完了後、`editor.tsx`（`addChord` の `isLocked` ゲート）と `presets.tsx` のロックが即座に解除される（`useEntitlements()` のリアクティブ更新）。
- **Pro プリセット追加**: 度数ベースで丸サ / Just The Two of Us / Pop Punk / 小室 / City Pop を `presetCatalog` に追加。無料=J-POP王道のみ、他は Pro ゲート。
- **課金アナリティクスのフック点**: `palette_pro_purchase_started` / `palette_pro_purchased` / `palette_pro_purchase_failed`（§5.12）を **`logger` スタブ**へ送る（PostHog は M4 で導入。Sprint 4 の方針を踏襲し、本文/進行は送らない）。

### Phase 5A の対象外（→ 5B / 後続 M）
- 実 `react-native-purchases` の配線、App Store Connect サブスクプロダクト作成、Sandbox 実購入（→ 5B）
- Convex によるサーバ側 entitlement 再検証（→ Phase 4 / M 後続）
- PostHog 実送信（→ M4）
- 設定 / 購入復元の**独立画面**（→ M4。5A では paywall 内の「購入を復元する」で最小提供）
- Pro 音色（アコギ / エレキ / ストリングス）の音源実装（→ V2）
- プリセット名の法務リネーム（→ M5）

### Phase 5B（次段・方針のみ）
- `react-native-purchases` を追加し、`RevenueCatBillingProvider` を `BillingProvider` 準拠で実装。`billingService` の注入先を Mock → RevenueCat に差し替えるのみ（画面・ドメインは不変）。
- App Store Connect に **自動更新サブスク `Palette Pro`（Subscription Group 内の月額プロダクト・¥490/月）** を作成し「送信準備完了」に。Sandbox テスターでサブスク購入・復元・自動更新・解約後の失効を検証。
- RevenueCat 側は entitlement `palette_pro` にこの月額プロダクトを紐付け、customerInfo の active entitlement を `Entitlements.palettePro` にマッピング。
- EAS 再ビルド必須（ネイティブ依存追加のため）。
- RevenueCat の entitlement を正典化し、将来 Convex Webhook 同期（サブスク状態のサーバ再検証）へ接続する余地を残す。

---

## 2. 変更予定ファイル

### 新規
- `src/services/billing/BillingProvider.ts` — 課金 Provider インターフェース（Strategy / Provider の抽象。型のみ、RN/Expo 非依存に近い純粋な契約）。
- `src/services/billing/MockBillingProvider.ts` — Mock 実装（購入/復元/失敗注入をメモリでシミュレート）。
- `src/services/billing/__tests__/billingService.test.ts` — 購入→entitlement 遷移、復元、失敗時の状態、リスナ通知の単体テスト。
- `src/data/presets.ts` に Pro プリセット追記（既存が `presetCatalog` を持つ場合は同ファイルへ追記。新規カタログ分割が必要なら `src/data/presets/proPresets.ts`）。
  - ※実装者は既存 `src/data/presets.ts` の構造を確認し、**度数ベース定義の1箇所集約**を維持すること。

### 変更（最小・理由明記）
- `src/services/billing/index.ts` — 既存の `useEntitlements` / `getEntitlements` / `__setEntitlementsForDev` は**維持**しつつ、`billingService`（`purchasePro` / `restore` / `getOfferings` / `initBilling`）を追加し、内部状態を Provider と同期。**理由**: 画面は既存フックに依存しているため、後方互換を保ったまま Provider を裏に差し込む（ripple 最小化）。
- `src/app/paywall.tsx` — 購入ボタン `onPress` / 復元ボタン `onPress` / ローディング・成功・失敗 UI を配線。価格は Provider 由来の `priceString` を **「¥490 / 月」の期間付き**で表示（ハードコード ¥490 を Provider 値へ差し替え）。既存の「買い切り」「一度の購入でずっと使える」等の文言を **サブスク文言（月額・自動更新・いつでも解約可能）** に置き換える。**理由**: M3 の主眼（購入導線の実処理化）＋商品モデル変更の反映。
- （必要時のみ）`src/app/_layout.tsx` 等の起動処理 — アプリ起動時に `billingService.initBilling()`（Provider 初期化＋既存 entitlement 復元）を1回呼ぶ。**理由**: Provider の初期化を Service 層に閉じ、画面から初期化ロジックを排除するため。
- `src/app/editor.tsx` / `src/app/presets.tsx` — **原則ロジック変更なし**。既存の `isLocked()` ＋ `useEntitlements()` が Provider 状態に追従するため、購入後のロック解除は自動反映される想定。差分が出るのはプリセット一覧に Pro 項目が増える点のみ（データ由来）。

### 必要ライブラリ
- **5A**: 追加なし（Mock は純 TypeScript）。
- **5B（本スプリント対象外）**: `react-native-purchases`（＋ EAS 再ビルド）。App Store Connect の自動更新サブスクプロダクト（Subscription Group）・RevenueCat ダッシュボード設定。

---

## 3. 課金 Provider 抽象（型・契約）

TS 型で定義し、Mock / 実 RevenueCat の両実装が同一契約を満たす。**画面は `billingService` のみに依存し、Provider 具象型を import しない。**

```ts
/** ストアから取得する（想定）サブスク商品。価格はローカライズ済み文字列を優先（§5.11）。*/
export interface BillingProduct {
  productId: string;      // 例: 'palette_pro_monthly'
  priceString: string;    // 例: '¥490'（ストア取得のローカライズ済み価格）
  period: 'month';        // サブスク期間（月額のみ）。UI は「/月」を付けて表示
  title: string;
}

/** 購入/復元/状態変化の結果。UI はこれを見てフィードバック・アナリティクスを出す。*/
export type BillingResult =
  | { status: 'purchased'; entitlements: Entitlements }   // サブスク登録成功（有効）
  | { status: 'restored'; entitlements: Entitlements }    // 既存サブスクの復元
  | { status: 'cancelled' }                 // ユーザー取消（失敗イベントにしない）
  | { status: 'error'; message: string };

/** 課金 Provider の抽象（Strategy / Provider）。Mock と RevenueCat が準拠する。
 *  買い切り/サブスクの購入形態はこの抽象の内側で吸収し、画面・ドメインは不変に保つ。*/
export interface BillingProvider {
  init(): Promise<void>;                          // 初期化＋現在の有効サブスク状態を復元
  getOfferings(): Promise<BillingProduct[]>;       // 表示価格（月額）の取得
  purchasePro(): Promise<BillingResult>;           // Palette Pro 月額サブスクに登録
  restore(): Promise<BillingResult>;               // サブスク購入の復元
  getEntitlements(): Entitlements;                 // 現在値（サブスク有効中のみ palettePro=true）
  onEntitlementsChange(cb: (e: Entitlements) => void): () => void; // 失効/更新も含め通知。購読解除を返す
}
```

- `billingService` は上記 Provider を1つ保持（DI）。既定は `MockBillingProvider`。5B で `RevenueCatBillingProvider` に差し替える。
- `billingService.purchasePro()` は Provider を呼び、サブスク有効化時に内部 `Entitlements` を更新して `useEntitlements()` の購読者へ通知（既存 `emit()` 経路を再利用）。**サブスク失効/解約時も `onEntitlementsChange` 経由で `palettePro=false` に切り戻す**。
- **Mock のサブスク状態は永続化しない**（アプリ再起動で未加入に戻る）。この暫定挙動は 5A の割り切りとしてドキュメント・コードヘッダに明記。5B の実サブスクは customerInfo の active entitlement を正典とし、復元で反映される。
  - ※もし「Mock 加入をローカル永続化して開発体験を上げる」を選ぶ場合は、`__setEntitlementsForDev` と混同しないよう Service 層に閉じ、production では無効化すること。

---

## 4. 音楽監修（Music Supervisor）を挟むステップ

本スプリントは課金配線が主で音の変更は小さいが、**Pro プリセットの度数定義は「音楽的内容」**であるため、音楽監修を以下の順序で挟む。

1. **実装前レビュー（music-supervisor）**: 追加する Pro プリセット5種（丸サ / Just The Two of Us / Pop Punk / 小室 / City Pop）の**度数・コード式・自動転調時の妥当性**をレビュー。特定録音物の再現を示唆しない一般化（§5.8）と、進行としての音楽的魅力を確認。指摘は `docs/music-supervisor-audit.md` に P0/P1/P2 で出力。
2. **実装（@generator）**: Provider 抽象＋Mock 購入/復元＋paywall 配線＋Pro プリセット追加を実装。
3. **デザイン仕上げ（@designer）**: paywall の購入/復元フィードバック（ローディング・成功・失敗）とロック導線の見た目を磨く。**機能・ロジックは変更しない**。
4. **聴感評価（music-supervisor）**: 追加 Pro プリセットを各キーで試聴し、転調後のボイシング・進行感が破綻しないか聴感評価（P0/P1 は @generator へ差し戻し）。
5. **QA（@evaluator）**: 下記 §7 の契約条件で合否判定。不合格は「機能→@generator / デザイン→@designer」に差し戻し、合格まで反復。

> 責務分離: **designer=見た目 / evaluator=契約・QA / music-supervisor=音楽的魅力**。音の良し悪しの最終判断は music-supervisor が担う。

---

## 5. リスクと対策

- **Mock と実 RevenueCat の契約ズレ** → Provider インターフェースを先に固め、Mock は「実装で起こりうる状態（cancelled / error / restored）」を全て返せるようにする。5B は同契約を満たすだけにする。
- **購入後にロックが解除されない（リアクティブ不整合）** → entitlement 更新は必ず既存 `emit()` / `useSyncExternalStore` 経路を通す。paywall・editor・presets が同一ソースを購読することをテストで担保。
- **client 申告の信用問題** → 5A の Mock/ローカル entitlement は暫定である旨を明記。恒久的な検証は Phase 4（Convex）で行う設計余地を残す。
- **プリセット名の法務リスク**（曲名由来） → データ定義を1箇所集約し、M5 のリネームを低コストにする。本スプリントでは公開しない前提で仮称のまま可。
- **Pro 音色の期待値ズレ** → paywall の perk 表示から「追加音色」を誤解させない文言に（V2 送りである旨。ただし要件表記との整合は designer/planner で確認）。

---

## 6. 動作確認方法 / 実機テスト項目（実機で確認できたものだけ「確認済み」と記す）

### 自動検証（オフライン）
- [ ] `npx tsc --noEmit` 0 エラー
- [ ] `npx jest`（既存 90 pass＋billingService テスト追加）
- [ ] `npx expo lint` 0

### 実機（Metro 反映で可・ネイティブ再ビルド不要）
- [ ] 無料状態で Pro コード（6th / 借用 / セカンダリードミナント / オンコード）タップ → paywall が開く
- [ ] 無料状態で Pro プリセット（丸サ等）タップ → paywall が開く
- [ ] paywall の価格が Provider 由来（ハードコードでない）で「¥490 / 月」の期間付き表示になる
- [ ] paywall にサブスク文言（月額・自動更新・いつでも解約可能）が表示される
- [ ] 「Palette Pro に登録」→ ローディング → 成功 → paywall が閉じる
- [ ] 購入（サブスク有効）後、editor の Pro コードが追加でき（ロック解除）、presets の Pro プリセットが読み込める
- [ ] 「購入を復元する」で復元が機能する（Mock）
- [ ] サブスク失効/解約（Mock 注入）で Pro がロックに戻る
- [ ] 購入失敗（Mock 注入）時にエラーフィードバックが出て、entitlement は変わらない
- [ ] 購入取消（cancelled）時は失敗イベントを送らず、静かに paywall へ戻る
- [ ] 追加 Pro プリセットが各キーで正しく自動転調して読み込める

---

## 7. 完了条件（Sprint 5A 契約）

### @generator への契約
- [ ] `BillingProvider` インターフェースと `MockBillingProvider` が実装され、`billingService` が Provider を DI で保持する
- [ ] 画面（paywall / editor / presets）に購入ロジック・`Purchases` 直書きが無い（層分離）
- [ ] paywall の購入/復元ボタンが `billingService` を呼び、サブスク有効化で `palettePro=true`・ロックが即時解除／失効で `palettePro=false` に戻る
- [ ] 価格表示が Provider 由来（`priceString`）で「¥490 / 月」の期間付き、サブスク文言（自動更新・解約可能）を表示
- [ ] Pro プリセット5種が度数ベースで追加され、無料=J-POP王道のみゲートが機能
- [ ] `palette_pro_purchase_started` / `_purchased` / `_purchase_failed` を `logger` スタブへ送出（本文/進行は送らない）
- [ ] billingService の単体テスト（サブスク登録→遷移 / 復元 / 失効 / 失敗 / cancelled / リスナ通知）がパス
- [ ] `tsc` 0 / `expo lint` 0 / `jest` パス

### @designer への契約
- [ ] paywall の購入中ローディング・成功・失敗フィードバックが破綻なく表示される
- [ ] ロックアイコン・Pro 導線がデザイントークンに沿い、無料/購入後の状態差が視覚的に伝わる
- [ ] **機能・ロジックを変更していない**（データ/サービスに触れない）

### music-supervisor への契約
- [ ] 追加 Pro プリセット5種の度数定義・転調妥当性・音楽的魅力を聴感評価し、P0/P1 指摘が無い（または差し戻し反映済み）
- [ ] 特定録音物の再現を示唆しない一般化が保たれている（§5.8）

### @evaluator への契約
- [ ] §6 実機テスト項目を満たす
- [ ] 要件 §10.4（ロック表示 / 購入画面 / 期間付き価格・サブスク文言 / 購入後の解放 / 復元 / 失効時の無効化）を **Mock 上で**満たす（Sandbox 実サブスク購入は 5B で再評価）
- [ ] エッジケース（購入失敗 / 取消 / 復元 / 失効・再加入 / 連続購入 / 各キー転調）で壊れない

### 5B（実 RevenueCat）完了条件（本スプリント対象外・記録のみ）
- [ ] `RevenueCatBillingProvider` が同契約で実装され、`billingService` の注入差し替えのみで動く
- [ ] Sandbox で Palette Pro 月額サブスク購入完了 → 解放、復元・自動更新・解約後失効が機能（実機）
- [ ] EAS 再ビルドで `react-native-purchases` がリンクされる
- [ ] `@evaluator` 合格

### 評価履歴
- **2026-07-19 @evaluator 判定: 合格（Mock/静的検証レベル）**
  - 静的検証: `npx tsc --noEmit` → 0 エラー / `npx jest` → 12 suites・100 tests 全 pass（`billingService.test.ts` 含む）/ `npx expo lint` → 0。
  - @generator 契約: 8 項目すべて充足を確認。
    - `BillingProvider` 抽象＋`MockBillingProvider` 実装、`billingService` が Provider を DI（`wireProvider`）で保持。
    - 層分離: 画面（`paywall`/`editor`/`presets`/`_layout`）に `Purchases`・購入ロジック直書きなし。課金は `billingService` 経由、ロック判定は domain の `isLocked()`＋`useEntitlements()`。
    - 購入→`palettePro=true`（`useSyncExternalStore` でリアクティブ即時解除）、失効(`__expireSubscription`)→`false` 切戻し、をテストで担保。
    - 価格は Provider 由来（`product.priceString`）＋「/ 月」期間付き、サブスク文言（月額・自動更新・いつでも解約可能）表示。旧「買い切り」文言は残存なし。
    - Pro プリセット 5 種（丸サ/Just The Two of Us/Pop Punk/小室/City Pop）を度数ベースで追加、無料=J-POP王道のみゲート。
    - 課金アナリティクス `palette_pro_purchase_started/_purchased/_purchase_failed` を logger スタブへ送出、本文/進行は非送信。cancelled は失敗イベントにしない。
    - 単体テスト（登録/復元/失効/再加入/失敗/取消/リスナ通知/community_plus 独立）網羅。
  - 要件 §10.4: ロック表示/購入画面遷移/期間付き価格・サブスク文言/購入後解放/復元/失効時無効化 を Mock 上で充足。Sandbox 実購入は 5B へ切り分け。
  - P1 差し戻し反映確認: `jpop-royal`=4536（IV-V-iii-vi / F·G·Em·Am）、`pop-punk`=I-V-vi-IV（C·G·Am·F）で重複解消済み（`presets.ts` / `presets.test.ts`）。
  - 軽微な観察（差し戻し対象外）: `paywall.tsx` に `FALLBACK_PRICE='¥490'`。offerings 解決前の一時表示のみで主表示は Provider 値のため許容。5B の実 Provider では取得失敗時の表示方針を再確認推奨。
  - **実機未検証（要ユーザー実機確認）**: 開発 PC が Windows のため以下は未検証。①Pro コード/プリセット タップ→paywall 遷移の実導線、②購入→ローディング→成功→自動クローズの体感、③購入後 editor/presets のロック即時解除の視覚反映、④価格・サブスク文言の実表示レイアウト崩れ、⑤各キー転調プリセットの実試聴（音楽的破綻の有無は music-supervisor 領域）、⑥Sandbox 実サブスク購入・復元・自動更新・解約後失効（→5B）。
