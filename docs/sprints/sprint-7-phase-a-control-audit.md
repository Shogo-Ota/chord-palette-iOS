# Sprint 7 Phase A — Control Audit（ボタン棚卸し）

作成日: 2026-07-19  
正典: `docs/sprints/sprint-7.md` §2 Phase A / `docs/design/ios-uiux-refinement.md` §4  
方法: 現行 `src/app/` のコード静的棚卸し（スクリーンショット Baseline は実機未取得 → 「要ユーザー撮影」）。

## 分類凡例
- **Keep**: L0 に残す（Core Loop）
- **Merge**: Session Capsule / Sheet へ統合
- **Move**: Overflow / Context Menu / 他画面へ
- **Remove**: 廃止（Auto-save 等で不要）
- **Hide**: 状態不足時は非表示（VISIBLE=READY）

---

## 1. `editor.tsx`（Core）

| 操作 | 現状 | 分類 | 設計書 §4 統合先 |
|---|---|---|---|
| Key chip → Key picker | 常時 | **Merge** | Session Capsule → Sheet「Key」 |
| Undo | 常時（disabled 時あり） | **Hide** | Contextual Undo（履歴なしで非表示） |
| Save | 常時 | **Remove** | Auto-save ＋ Toast |
| Close（×） | 常時 | **Move** | Top Overflow または戻るジェスチャと整理 |
| BPM − / 表示 / ＋ / Tap | 常時 | **Merge** | Session Capsule → Sheet「Tempo」 |
| Play/Pause | 進行0で disabled | **Keep**＋**Hide/Transform** | Transport 唯一の Filled。空進行時は「最初のコードを選ぶ」へ変形可 |
| Groove chip | → `/groove` | **Merge** | Session Capsule → Sheet「Style」 |
| Instrument chip | → `/groove` | **Merge** | Session Capsule → Sheet「Sound」 |
| Chord card tap（選択） | 常時 | **Keep** | Chord Canvas |
| Chord card 試聴 | 選択時 | **Keep** | Tap=試聴 |
| Duration 1/2/1/4 | 選択時 | **Move** | Chord Context Menu（Long Press） |
| Duplicate / Move←→ / Delete | 選択時 | **Move** | Chord Context Menu（Delete=Destructive） |
| Library open chevron | 常時 | **Keep**（または Add Slot に統合） | Chord Picker Sheet |
| Library chords / variations / slash | 展開時 | **Keep** | Chord Picker Sheet |
| Export CTA | 常時 | **Move** | Top Overflow（最頻なら上段維持も可） |
| BPM modal / Key modal | モーダル | **Merge** | Session Sheet 内へ |

### editor の問題（無効・重複）
- Save と Auto-save（既に保存経路があるなら）の**重複候補** → Remove Save。
- Undo が `disabled` 表示 → Hide に変更（契約 UNAVAILABLE=HIDE）。
- Play が進行0で `disabled` → Transform 推奨。
- Groove と Instrument が**別チップで同じ `/groove` へ** → Session Capsule 1ボタンへ Merge。
- Chord 編集ボタン列（4個）が常時選択時に並ぶ → Context Menu へ Move（Complexity Budget）。

---

## 2. `index.tsx`（Home）

| 操作 | 分類 | 備考 |
|---|---|---|
| 新しい進行を作る | **Keep** | Primary CTA |
| プリセット | **Keep** | 導線 |
| プロジェクト行 | **Keep** | |
| 削除 | **Move** | 長押し/スワイプ or Overflow（危険操作） |
| DEV 診断リンク | **Hide** | Feature Flag / `__DEV__` のみ（Release 非表示） |

---

## 3. `groove.tsx`

| 操作 | 分類 | 備考 |
|---|---|---|
| Back | **Keep**（当面） | 将来 Session Sheet 内包で画面自体 Move |
| Play | **Keep** | 試聴 |
| Groove 選択 | **Merge** | Session Sheet「Style」へ |
| Instrument 選択 | **Merge** | Session Sheet「Sound」へ |

Phase C 完了後、独立 `/groove` は Session Sheet に吸収可能（ナビは維持しつつ UI 統合）。

---

## 4. `presets.tsx` / `paywall.tsx` / `export.tsx`

| 画面 | 操作 | 分類 |
|---|---|---|
| presets | Back / Free・Pro タブ / カード | **Keep**（課金ゲート維持） |
| paywall | Close / 購入 / 復元 | **Keep**（Sprint 5 済み） |
| export | Back / 尺選択 / 保存 / 共有 | **Keep**（機能済み。Overflow から開く導線に） |

---

## 5. `dev-audio.tsx`

| 操作 | 分類 |
|---|---|
| 全操作 | **Hide** | Release Build では Feature Flag 非表示（設計書 §4「未実装/Coming Soon」と同趣旨） |

---

## 6. 差分マップ要約（Phase C への入力）

```
[常時 L0]
  Chord Canvas / Add・Picker / Play-Pause / Session Capsule(1)

[L1 Session Sheet]  ← Merge
  Key, Tempo(BPM±/Tap), Style(groove), Sound(instrument)

[L2 Context Menu]  ← Move
  Duration, Duplicate, Move, Delete

[L2 Overflow ⋯]  ← Move
  Export, Close/Projects, Help(将来)

[Remove]
  Save ボタン

[Hide]
  Undo（履歴なし）, Loop（<2 chords・未実装なら非表示）, DEV 画面
```

### 現状の常設 Utility 概算（editor）
Key / Undo / Save / Close / BPM×3〜4 / Play / Groove / Instrument / Export ≈ **10+**  
→ Phase C Exit（≤7）未達。本 Audit の Merge/Remove/Move 適用が必須。

---

## 7. Baseline（実機）

| 項目 | 状態 |
|---|---|
| Core Loop 操作動画 | **未取得**（ユーザー実機で撮影推奨） |
| 主要画面スクショ | **未取得** |

Exit Criteria「Baseline スクショ/動画」はユーザー実機依存。コード棚卸しと差分マップは本ファイルで充足。

---

## Phase A Exit

- [x] 無効・重複 Action 一覧（§1 editor 問題）
- [x] Keep/Merge/Move/Remove/Hide 差分マップ（§6）
- [ ] Baseline スクショ/動画（実機・ユーザー）

→ **コード監査としては Phase A 完了**。Baseline 撮影をユーザーに依頼しつつ Phase B へ進めてよい。
