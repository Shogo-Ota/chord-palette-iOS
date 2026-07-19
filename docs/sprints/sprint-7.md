# Sprint 7 — UI/UX 洗練化（M4 / UI磨き）実装カード

正典: `Chord_Palette_iOS_MVP_Requirements_v1.md`（特に §10.5 / §11 P1「表示アニメーション」「初回ヒント」 / §6 情報設計）＋ UI/UX 設計書 `docs/design/ios-uiux-refinement.md`（North Star〜§9 Release Gate）＋ 本カード。
前提: M1 オーディオ / M2 動画書き出し は `master` 統合済み。M3（Sprint 5A 課金 Mock）→ M?（Sprint 6 音源改修）の順で進行中。

> **North Star（設計書）**: 「5秒で音が鳴り、30秒で"自分の進行"が形になり、説明書なしで次の一手が分かる。」
> 本スプリントは `docs/release-plan.md` の **M4（UI磨き）** に相当。設計書 §1〜§9 の思想・情報構造・削減マトリクス・実装契約・Release Gate を**そのまま採用**する。

---

## 0. 前提・確定した方針（2026-07-19 ユーザー決定）

- **着手タイミング（順序厳守）**: 本スプリントは **Sprint 6（音源改修）を一区切りしてから着手**する（パイプライン: sprint-5 M3 → sprint-6 音源 → **sprint-7 UI/M4**）。音を変えるスプリントではない。
- **プラットフォーム読み替え（SwiftUI → React Native）**: 設計書 §7 は SwiftUI 記法だが、現行 UI は **Expo React Native（expo-router）**（Swift はネイティブ音楽/動画エンジンのみ）。**思想・情報構造・削減マトリクス（§4）・実装契約（§5・§7）・Release Gate（§9）はそのまま採用**し、**コンポーネント名のみ RN に読み替える**（下記 §0.1 Mapping）。
- **実装契約の最上位ルール（設計書 §7・厳守）**: **既存の「音楽ロジック（`src/lib`）・Data Model（`src/types` / repositories / session）・Audio Engine（`chord-audio` / `src/services/audio`）・Core Navigation（expo-router のルート構成）」は変更しない。** 本スプリントは**表示層（`src/app` の画面・`src/components`・`src/theme`）と、表示可否を司る薄い ViewModel/hook の追加**に限定する。
- **音楽監修は原則対象外**（音を変えないため）。ただし機能和声色（T/SD/D）の Accent 表現など「音楽的意味を持つ視覚表現」を変える場合のみ、designer が music-supervisor に確認する。
- **現行アーキテクチャ（RN＋層分離）を尊重**: UI は業務ロジックを持たない。可否条件・状態は ViewModel/hook 側（`src/features/editor/`）に集約し、View は宣言的に描画する。

### 0.1 コンポーネント Mapping（設計書 SwiftUI 名 → 本PJ RN）

| 設計書（SwiftUI） | 本PJ（React Native） | 現状の所在 |
|---|---|---|
| `PaletteScreen` | メイン画面 | 既存 `src/app/editor.tsx` |
| `PaletteTopBar` + `OverflowMenu` | `CPTopBar` + `CPOverflowMenu`（新規） | 現状 editor 内にインライン |
| `SessionSummaryCapsule` | `CPSessionCapsule`（新規） | Key/BPM/Style/Sound が現状バラバラに配置 |
| `SessionSettingsSheet` | `CPSessionSheet`（新規・RN Modal/ボトムシート） | Style は `src/app/groove.tsx`、他は editor インライン |
| `ChordCanvas` | Chord タイムライン（既存を部品化） | editor 内 |
| `ChordCard` | `CPChordCard`（新規） | editor 内インライン |
| `AddChordSlot` | `CPAddSlot`（新規） | editor 内 |
| `SuggestionStrip`（任意） | `CPSuggestionStrip`（新規・必要時のみ） | 無し |
| `TransportBar` | `CPTransportBar`（新規） | editor 内インライン |
| `ContextualUndo / PlayPause / Loop` | `CPPlayPauseButton`（新規）＋ Undo/Loop 制御 | editor 内インライン |
| `ChordPickerSheet` | `CPChordPickerSheet`（新規） | editor 内のライブラリ（diatonic/advanced/slash タブ） |
| `ChordContextMenu`（Long Press） | `CPChordContextMenu`（新規） | 現状 Edit/複製/削除等が個別ボタン |
| `DesignToken` | 既存 `src/theme/tokens.ts` を拡張 | colors/font/radius 等は既存 |

---

## 1. スコープ境界（対象 / 対象外）

### 対象
- メイン画面（`editor.tsx`）の**操作の3階層化**（L0 Play Canvas / L1 Session Sheet / L2 Menu・Context）と情報構造の再編（設計書 §2・§3）。
- **ボタン削減・共通化**（設計書 §4 マトリクス）: Key/Scale/Transpose・BPM・Style・Sound を Session Capsule/Sheet へ統合。Chord 操作を Long Press Context Menu へ。Save 廃止（Auto-save）。Undo/Loop の表示制御。Overflow への集約。
- **DesignToken 集約と共通部品の RN 化**（設計書 §6・§7）。
- **Delight**（Playhead/Card Motion/Haptics/Starter Progression/復帰 Session/Error・Loading Feedback）。
- **アクセシビリティ・端末サイズ検証**（Dark Mode/Dynamic Type/VoiceOver/iPhone SE〜Pro Max）。
- `visibleActions` / ActionState（`hidden/ready/loading`）/ Feature Flag / Auto-save / Undo 表示制御 の**ロジック側追加**（表示可否のみ。業務ロジック不変）。

### 対象外（→ 他スプリント / 後続）
- **音楽ロジック・Data Model・Audio Engine・Core Navigation の変更**（禁止）。
- 音源・演奏内容の変更（→ Sprint 6）。
- 課金ロジック（→ Sprint 5。paywall の見た目微調整は Sprint 5 の designer 契約範囲）。
- 動画書き出しの機能追加（→ Sprint 4 済み。UI 表現の調整は最小）。
- 新しい音楽機能・新プリセット等の追加（本スプリントは UI 洗練のみ）。
- 5人 Usability Test の被験者手配など運用（Exit の指標は定義するが、実施可否は環境依存）。

---

## 2. 作業ステップ（Phase A〜E）と Exit Criteria

> 設計書 §8 の移行ロードマップを踏襲。**挙動を壊さないため段階 PR**とし、各 Phase の Exit Criteria を満たしてから次へ進む。

### Phase A — Control Audit（棚卸し・Baseline）
- **作業**: 現行 `src/app/` 各画面（`index` / `editor` / `groove` / `presets` / `export` / `paywall`）の全ボタン・操作を **Keep / Merge / Move / Remove / Hide** で棚卸しし、**差分マップ**を作る（どの操作が §4 マトリクスのどこへ行くか）。現状のスクリーンショットと Core Loop の操作動画を **Baseline** 化。
- **Exit Criteria**: 無効・重複 Action の一覧と、各操作の Keep/Merge/Move/Remove/Hide 分類（差分マップ）が揃う。Baseline スクショ/動画が保存される。

### Phase B — Foundation（トークン集約・共通部品）
- **作業**: `src/theme/tokens.ts` を拡張し **Spacing（4/8/12/16/24/32）・Radius（Card 16 / Sheet 20 / Capsule）・Typography（Chord 24–28 Semibold / Body 17 / Label 13）・Motion（選択 120ms / Card 180–220ms / Reduce Motion フォールバック）・Haptics** を Token 化。共通部品 **`CPChordCard` / `CPSessionCapsule` / `CPPlayPauseButton` / `CPTransportBar`**（＋必要に応じ `CPAddSlot`）を RN で作成。
- **Exit Criteria**: 新部品へ差し替えても**既存挙動の Snapshot 差分が無い**（見た目・操作が回帰しない）。直値の色/余白/角丸/フォントが対象範囲から排除され Token 参照になっている。

### Phase C — Consolidation（統合・削減）
- **作業**: **Key/BPM/Style/Sound を `CPSessionCapsule`→`CPSessionSheet` に統合**（個別ボタン削除）。**Chord 操作（Edit/Inversion/複製/Delete）を `CPChordContextMenu`（Long Press）へ**（Delete のみ Destructive 色）。**Save を廃止し Auto-save**（成功は一時 Toast）。**Undo は変更後だけ表示・Loop は 2 Chord 以上で表示**。Share/Export/Project/Help を **Overflow（⋯）へ集約**（実装済み項目のみ）。
- **Exit Criteria**: Core 画面（editor）の **常設 Utility Button ≤ 7**／同一 Action の重複配置 = 0／Add Button 重複 = 0。Auto-save で保存が成立し再起動復元が回帰しない。

### Phase D — Delight（体験の質）
- **作業**: 再生中 Card の浮き（120–220ms）＋拍に沿う細い Ring（Playhead）／Card Motion／**Haptics**（Chord 選択=selection、Drop=soft impact、初回 4Chord 完成=success、毎拍禁止）／初回は **Starter Progression（すぐ鳴る）**／**復帰時に前回 Session を即表示**／**Error・Loading Feedback**（音源 Load 失敗は Retry をその場に提示）。
- **Exit Criteria**: 初回発音を妨げる Modal（Login/説明 Carousel/権限要求）が発音前に **0**。Reduce Motion 時に Opacity/Stroke へフォールバックしつつ操作継続可能。

### Phase E — Validation（検証・Release Gate 通過）
- **作業**: Dark Mode / Dynamic Type / VoiceOver / iPhone SE〜Pro Max / 音源 Load 失敗 /（可能なら）Usability 観察で検証。
- **Exit Criteria**: **§7 の Release Gate を全通過**（数値・チェック）。

---

## 3. 実装契約（IMPLEMENTATION CONTRACT・設計書 §5・§7）

- **VISIBLE = READY / UNAVAILABLE = HIDE・TRANSFORM / LOADING ≠ DEAD** を厳守。
- **ViewModel/hook が `visibleActions` を返す**。View 側に可否条件を重複させない（例: `useEditorActions()` が現在の Session 状態から「表示すべき Action と各 state」を算出）。
- **ActionState は `hidden / ready / loading` の3値**。**未実装を `disabled` で表現しない**（Feature Flag で**非表示**にする）。`disabled(true)` は例外理由コメント＋UI テスト必須。
- **DesignToken に集約・直値禁止**: Color・Spacing・Radius・Typography・Motion は `src/theme/tokens.ts` 経由でのみ参照。
- **表示 Action 追加時は同一 PR に** handler・feedback（≤100ms 視覚反応）・analytics（PostHog 未導入時は `logger` スタブ）・accessibility（Label/Hint/Value）・（可能なら）テストを含める。
- **同じ Action を Top Bar / Canvas / Sheet に重複配置しない。**
- **色は iOS Semantic Color 基調＋Brand Hue は Accent 限定**。機能和声色（T/SD/D/借用）は細い Edge/Accent のみ（全面塗り・多色グラデを避ける）。

---

## 4. 変更・新規ファイル / 必要ライブラリ

### 新規（表示層・部品）
- `src/components/palette/CPChordCard.tsx` / `CPSessionCapsule.tsx` / `CPPlayPauseButton.tsx` / `CPTransportBar.tsx` / `CPAddSlot.tsx` / `CPChordContextMenu.tsx` / `CPOverflowMenu.tsx` / `CPSuggestionStrip.tsx`（必要時）
- `src/components/palette/CPSessionSheet.tsx` / `CPChordPickerSheet.tsx`（RN Modal/ボトムシート）
- `src/features/editor/useEditorActions.ts`（`visibleActions` / ActionState を返す hook・純ロジック寄り・テスト可）
- `src/features/editor/useAutosave.ts`（Auto-save 制御。**保存の実処理＝既存 repository/session を呼ぶだけ**でロジックは変えない）
- `src/config/featureFlags.ts`（未実装 Action の非表示制御）
- 各 `__tests__`（`useEditorActions` の可否算出、autosave のデバウンス等の純ロジック）

### 変更（表示層のみ・最小）
- `src/theme/tokens.ts` — Spacing/Radius/Typography/Motion/Haptics トークン拡張（既存キーは保持）。
- `src/app/editor.tsx` — 新部品への差し替え・3階層化・削減の反映（**session/playback の呼び出し先は不変**）。
- `src/app/groove.tsx` — Style 選択を `CPSessionSheet` に統合（ルート自体を消す場合も Core Navigation の意味は保持。要 Phase A 判断）。
- `src/app/index.tsx` / `presets.tsx` / `export.tsx` — Token・共通部品への追随（機能不変）。

### 触らない（禁止・明記）
- `src/lib/**`（音楽ロジック）／`src/types`・`src/repositories`・`src/features/editor/session.ts` の Data Model／`modules/chord-audio`・`src/services/audio`（Audio Engine）／expo-router のルート意味論（Core Navigation）。

### 必要ライブラリ
- 触覚: `expo-haptics`（未導入なら追加）。ボトムシート/コンテキストメニューは既存 RN `Modal`＋長押しで実装可（新規重量級依存は避ける。導入する場合は理由を明記し designer/planner で承認）。
- **TS のみの変更が中心**で Metro 反映。`expo-haptics` 追加時のみネイティブ再ビルドが要る点に留意。

---

## 5. リスクと対策

- **大規模 UI 改修による既存機能退行・ナビゲーション破壊** → **Phase A の Baseline（スクショ/操作動画）** と **Snapshot 差分**、**段階 PR**（Phase 単位）、**機能テスト回帰**（play/pause/stop/loop/追加/削除/複製/移動/保存/再起動復元/転調/書き出し）で担保。
- **「触らない層」への波及** → 変更は表示層と薄い ViewModel に限定。session/repository/audio の**公開 API は呼ぶだけ**でシグネチャを変えない。
- **Auto-save の保存頻度過多** → デバウンスし、保存成立と再起動復元を回帰確認（Data Model は不変）。
- **アクセシビリティ後付けの漏れ** → Action 追加時の同一 PR チェックリスト（§3）で必須化。
- **Reduce Motion / Dynamic Type 破綻** → Phase E で明示検証。Motion は Token のフォールバックで吸収。
- **groove ルート統合の影響** → ルートを消す/残すは Phase A で判断し、Core Navigation の意味（画面遷移なしで Core Loop 完了）を壊さない方を採る。

---

## 6. 役割分担

- **主担当 = @designer**: 情報構造・3階層化・削減マトリクス適用・DesignToken・共通部品・Motion/Haptics/色・アクセシビリティ・Release Gate の見た目/体験面。
- **@generator（ロジック側）**: `visibleActions` / ActionState（`hidden/ready/loading`）/ Feature Flag / Auto-save / Undo・Loop 表示制御 の hook・純ロジックと単体テスト。**業務ロジック・Data Model は変えない。**
- **music-supervisor**: 本スプリントは**原則対象外**（音を変えない）。機能和声色など音楽的意味を持つ視覚表現の変更時のみ確認。
- **@evaluator**: §7 の Release Gate（数値）と機能回帰を判定。

---

## 7. 動作確認 / 完了条件（Sprint 7 契約）

### 自動検証（オフライン）
- [ ] `npx tsc --noEmit` 0 / `npx expo lint` 0 / `npx jest`（既存＋`useEditorActions`/autosave テスト）パス
- [ ] 共通部品差し替え後の Snapshot 差分レビュー（Phase B の回帰なし）

### @designer への契約
- [ ] 操作が L0/L1/L2 の3階層に整理され、Core Loop（選ぶ→並べる→聴く）が**画面遷移なし**で完了する
- [ ] §4 削減マトリクスが適用（Key/BPM/Style/Sound は Session Capsule/Sheet、Chord 操作は Long Press、Save 廃止=Auto-save、Overflow 集約）
- [ ] Color/Spacing/Radius/Typography/Motion/Haptics が DesignToken に集約され、対象範囲に直値が無い
- [ ] Delight（Playhead/Card Motion/Haptics/Starter Progression/復帰 Session/Error・Loading Feedback）が実装され、発音前に妨げる Modal が無い

### @generator（ロジック側）への契約
- [ ] ViewModel/hook が `visibleActions` を返し、View に可否条件が重複しない
- [ ] ActionState は `hidden/ready/loading` の3値。未実装は Feature Flag で**非表示**（`disabled` にしない）
- [ ] Auto-save が既存 session/repository を呼ぶだけで成立し、Data Model を変更していない
- [ ] Undo は履歴がある時だけ、Loop は 2 Chord 以上で表示される
- [ ] 音楽ロジック・Data Model・Audio Engine・Core Navigation を変更していない（差分レビューで確認）

### @evaluator への契約 — Release Gate（設計書 §9・数値で判定）

**UI SIMPLICITY**
- [ ] Core 画面（editor）の表示中 **Disabled Button = 0**
- [ ] Chord Card を除く**常設 Utility Button ≤ 7**
- [ ] **横一列の Glyph Button ≤ 3**／**Filled CTA = 1**（Play/Pause のみ）
- [ ] **同一 Action の重複配置 = 0**／**未実装 Action の露出 = 0**
- [ ] 全 **Tap Target ≥ 44×44pt**／曖昧 Icon は Text/Accessibility で補足

**RETENTION / QUALITY**
- [ ] 初回発音：中央値 **≤ 5秒**／4Chord 完成：中央値 **≤ 60秒**
- [ ] **Tap Feedback ≤ 100ms**／Warm Audio Response ≤ 80ms
- [ ] **VoiceOver / Dark Mode / Reduce Motion / Dynamic Type** で Core Loop を完遂できる
- [ ] **Crash / Note stuck / Button dead-end = 0**
- [ ] （可能なら）5人中5人が無説明で再生、4人以上が 4Chord 作成

**回帰（機能不変の担保）**
- [ ] play/pause/stop/loop・追加/削除/複製/移動/長さ変更・保存/再起動復元・転調・動画書き出し が改修前と同等に動作
- [ ] iPhone SE〜Pro Max のサイズで破綻なし／音源 Load 失敗時に Retry が提示される

### 評価履歴
- 2026-07-19 Phase A〜C: Control Audit / Foundation / Consolidation（静的 PASS）
- 2026-07-19 Phase D: Delight（Haptics / Playhead / Starter / Resume / Retry）静的 PASS
- 2026-07-19 Phase E: 自動検証 PASS・Release Gate は CONDITIONAL PASS（実機チェックリスト残）→ `docs/sprints/sprint-7-phase-e-release-gate.md`

---

## 8. 次スプリント / V2 への申し送り
- Usability Test（5人）を環境が整い次第実施し、初回発音≤5秒・4Chord≤60秒の実測を Release Gate に反映。
- `CPSuggestionStrip`（次の一手サジェスト）は Core Loop 寄与が確認できたら L1/L0 へ昇格検討（設計書 §2 昇格ルール）。
- PostHog 導入後（M4 後半 or 後続）、Action の analytics スタブを実イベントへ差し替え（本文/進行は送らない）。
