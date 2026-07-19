# Chord Palette iOS — UI/UX 洗練化設計書

> 出典: ユーザー提供 `Chord_Palette_iOS_UIUX_洗練化設計書.pdf`（v1.0 / 2026-07-19）。
> 本ファイルは PDF の内容をリポジトリ参照用に転記したもの。
>
> **本プロジェクトでの読み替え注意**: 設計書 §7 は「SwiftUI コンポーネント構成」で書かれているが、現行 Chord Palette の **UI は Expo React Native（expo-router）** で実装されている（Swift はネイティブ音楽/動画エンジンのみ）。
> したがって **コンポーネント名（PaletteScreen / ChordCard / SessionCapsule 等）は React Native コンポーネントへ読み替え**、思想・情報構造・削減マトリクス・契約・Release Gate をそのまま採用する。
> スコープ的には `docs/release-plan.md` の **M4（UI磨き）** に相当（音源改修=sprint-6 とは別軸）。

North Star: **5秒で音が鳴り、30秒で「自分の進行」が形になり、説明書なしで次の一手が分かる。**

## 1. 壊してはいけない設計思想
- **コードが主役**: 装飾や設定より Chord Card と音を最も強く見せる。
- **触れば鳴る**: 最初の意味ある操作に、音・視覚・触覚で即応。
- **設定させない**: 良い初期値を選び、音楽理論と高度設定は必要時だけ開示。
- **1画面で完結**: 選ぶ→並べる→聴く の Core Loop を画面遷移なしで完了。
- **失敗できる**: Auto-save と Undo で試行錯誤の心理コストをなくす。

## 2. 操作を3階層へ畳み込む
- **L0 Play Canvas**（常時表示）: Chord Card／Add Slot／Play-Pause／Session Capsule。Core Loop だけ。
- **L1 Focused Sheet**: Key・BPM・Style・Sound を1枚の Session Sheet へ。Chord Picker は追加時だけ。
- **L2 Menu / Context**: Export・Project・Help・危険操作。Chord 固有操作は Long Press の Context Menu。
- **昇格ルール**: 新機能はまず L2 へ。利用頻度と Core Loop への寄与が証明された場合だけ L1/L0 へ上げる。画面に空きがあることはボタン追加の理由にならない。

## 3. メイン画面の完成形（情報構造）
- **TOP BAR**: ‹ Projects｜Palette title（自動保存表示は短時間のみ）｜⋯
- **SESSION CAPSULE · 1 BUTTON**: `C Major · 104 BPM · Pop 8 · Piano ▶`。Tap で Session Sheet。
- **CHORD CANVAS**: `[Cmaj7][Am7][Fmaj7][G7][＋]`。Tap=試聴／Drag=並替／Long Press=編集。
- **MOMENT OF DELIGHT**: 再生中の Card だけが 120–220ms で浮き、拍に合わせて細い Ring が進む。機能和声色は細い Accent のみ。
- **TRANSPORT · MAX 3**: `[↶ Undo：履歴がある時だけ] [▶/Ⅱ：唯一の Filled Button] [↻ Loop：2 Chord 以上で表示]`。
- **Complexity Budget**: Chord Card を除く常設 Utility Button は最大7個／横一列の Glyph Button は最大3個／Filled Accent Button は画面内1個。

## 4. ボタン共通化・削減マトリクス

| 現状に生じやすい操作 | 統合先 | 新しい操作 | 表示ルール |
|---|---|---|---|
| Key／Scale／Transpose | Session Capsule | Tap → Session Sheet の「Key」 | 常時1ボタンへ統合 |
| BPM −／＋／Tap Tempo | Session Capsule | 同 Sheet の「Tempo」 | 個別ボタン削除 |
| Rhythm／Beat／Style | Session Capsule | 同 Sheet の「Style」 | 個別ボタン削除 |
| Instrument／Tone／Reverb | Session Capsule | 同 Sheet の「Sound」 | 個別ボタン削除 |
| Play／Stop／Restart | Play-Pause Toggle | 状態に応じて ▶↔Ⅱ。再開位置は Playhead。進行が空なら「最初のコードを選ぶ」へ変形 | |
| Add／Insert | 末尾の Add Slot | Tap で Chord Picker。選択 Card の後へ挿入も可 | Add Button の重複禁止 |
| Edit／Inversion／Duplicate／Delete | Chord Context Menu | Long Press。Delete のみ Destructive 色 | Card 選択時だけ存在 |
| Save | Auto-save | 変更ごとに保存。成功表示は一時的 Toast | Save Button を廃止 |
| Undo／Redo | Contextual Undo | 変更後だけ ↶ 表示。Long Press で Redo/History | 履歴なしでは非表示 |
| Share／Export／Project／Help | Top Overflow Menu | ⋯へ集約。最頻の1項目だけ上段 | 実装済み項目だけ列挙 |
| 未実装／Coming Soon | Feature Flag | Release Build では表示しない | 無効ボタン化を禁止 |

## 5. 「ボタンがあるのに使えない」をゼロへ近づける契約
- **VISIBLE = READY**: 表示する Action は必ず handler 接続済み／Tap から 100ms 以内に視覚 Feedback／成功・失敗・Cancel の出口を持つ／Accessibility Label・Hint・Value を設定。
- **UNAVAILABLE = HIDE / TRANSFORM**: 状態不足は次の有効 Action へ変形／履歴なし Undo・1Chord 時 Loop は非表示／未実装は Feature Flag で非表示／権限不足は Button 有効のまま理由と導線を提示。
- **LOADING ≠ DEAD**: 処理中は Label を Progress へ置換／二重 Tap 抑止だが停止状態に見せない／音源 Load 失敗は Retry をその場に提示／`disabled(true)` は例外理由コメント＋UI Test 必須。

## 6. 魅力を生む Visual・Motion・Retention 設計

| 要素 | 仕様 | 禁止／受入 |
|---|---|---|
| 色 | 背景／文字は iOS Semantic Color。既存 Brand Hue を Accent に限定。Tonic/Pre-Dominant/Dominant/Borrowed は細い Edge 色だけ。 | 派手な全面塗り・多色 Gradient を避ける |
| 形 | Chord Card radius 16、Sheet/Panel 20、Session Capsule は Capsule。Spacing は 4/8/12/16/24/32。 | 角丸値と余白を Token 化 |
| 文字 | SF Pro / Dynamic Type。Chord 24–28 Semibold、Body 17、Label 13。略語だけで意味を隠さない。 | VoiceOver と文字拡大で破綻なし |
| Motion | 選択 120ms、Card 遷移 180–220ms、Spring は弱く。Reduce Motion 時は Opacity/Stroke へ。 | アニメーション中も操作可能 |
| Haptics | Chord 選択=selection、並替 Drop=soft impact、初回 4Chord 完成=success。毎拍の Haptic は禁止。 | 意味のある節目だけ |
| 離脱防止 | 初回は Blank Canvas にせず「すぐ鳴る Starter Progression」。Login・説明 Carousel・権限要求を初回発音より前に置かない。 | 復帰時は前回 Session を即表示 |

## 7. コンポーネント構成と実装制約（SwiftUI 記法 → 本PJは React Native へ読み替え）

コンポーネントツリー:
```
PaletteScreen
├─ PaletteTopBar + OverflowMenu
├─ SessionSummaryCapsule → SessionSettingsSheet
├─ ChordCanvas → ChordCard / AddChordSlot
├─ SuggestionStrip（必要時だけ）
└─ TransportBar → ContextualUndo / PlayPause / Loop
Sheets: ChordPickerSheet / SessionSettingsSheet
```

実装契約（IMPLEMENTATION CONTRACT）:
- **既存の音楽ロジック・Data Model・Audio Engine・Core Navigation は変更しない。**
- ViewModel が `visibleActions` を返し、View 側に重複した可否条件を書かない。
- ActionState は `hidden / ready / loading`。未実装を `disabled` で表現しない。
- Color・Spacing・Radius・Typography・Motion を DesignToken へ集約し、直値を禁止。
- 表示 Action 追加時は handler・feedback・analytics・accessibility・UI test を同 PR に含める。
- 同じ Action を Top Bar／Canvas／Sheet へ重複配置しない。

## 8. 移行ロードマップ（挙動を壊さず 1〜2週間）

| Phase | 目安 | 作業 | Exit Criteria |
|---|---|---|---|
| A. Control Audit | 0.5日 | 全画面の Button を Keep/Merge/Move/Remove/Hide で棚卸し。現状 Screenshot と操作動画を Baseline 化。 | 無効・重複 Action 一覧 |
| B. Foundation | 1〜2日 | DesignToken、CPChordCard、CPSessionCapsule、CPPlayPauseButton、CPTransportBar を作成。 | 既存挙動の Snapshot 差分なし |
| C. Consolidation | 2〜3日 | Key/BPM/Style/Sound を Session Sheet へ統合。Chord 操作を Context Menu へ。Auto-save で Save 削除。 | Core 画面の Utility Button ≤7 |
| D. Delight | 1〜2日 | Playhead、Card Motion、Haptics、Starter Progression、復帰 Session、Error/Loading Feedback。 | 初回発音を妨げる Modal 0 |
| E. Validation | 2日 | Dark Mode、Dynamic Type、VoiceOver、iPhone SE〜Pro Max、音源 Load 失敗、5人 Usability Test。 | Release Gate を全通過 |

## 9. Release Gate（数値で守る）

UI SIMPLICITY:
- Core 画面の表示中 Disabled Button = 0
- Chord Card を除く常設 Utility Button ≤ 7
- 横一列の Glyph Button ≤ 3、Filled CTA = 1
- 同一 Action の重複配置 = 0、未実装 Action の露出 = 0
- 全 Tap Target ≥ 44×44pt、曖昧 Icon は Text/Accessibility で補足

RETENTION / QUALITY:
- 初回発音：中央値 ≤ 5秒、4Chord 完成：中央値 ≤ 60秒
- 5人中5人が無説明で再生、4人以上が 4Chord 作成
- Tap Feedback ≤ 100ms、Warm Audio Response ≤ 80ms
- VoiceOver・Dark Mode・Reduce Motion・Dynamic Type で Core Loop 完遂
- Crash／Note stuck／Button dead-end = 0

## 10. Apple 一次情報（2026-07-19 確認）
Buttons（System Button／44×44pt）／Menus（省スペースな Command 提示）／Context menus（Item 固有操作）／Sheets（親画面へ戻る Focused Task）／Toolbars（Control の論理 Group）／Feedback・Haptics／Accessibility／SF Symbols。

前提: 現行 Chord Palette の中核を「コードを選ぶ・並べる・すぐ聴く」と置いた UI 洗練化設計。現行画面との差分は Phase A で Control Audit し、Data Model と音楽ロジックを維持したまま Mapping する。
