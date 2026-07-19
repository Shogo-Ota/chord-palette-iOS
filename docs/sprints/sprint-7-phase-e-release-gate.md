# Sprint 7 — Phase E Release Gate（検証メモ）

正典: `docs/sprints/sprint-7.md` §7 / 設計書 `docs/design/ios-uiux-refinement.md` §9。
実施日: 2026-07-19。環境: Windows 開発機（静的検証）＋実機はユーザー側（EAS 後）。

## 1. 自動検証（オフライン）

| 項目 | 結果 | メモ |
|---|---|---|
| `npx tsc --noEmit` | ✅ 0 | 2026-07-19 |
| `npx jest` | ✅ 178 / 178 | 2026-07-19 |
| `npx expo lint` | ✅ 0 | 2026-07-19 |

## 2. UI SIMPLICITY（静的コードレビュー）

| Gate | 判定 | 根拠 |
|---|---|---|
| Core 画面の表示中 Disabled Button = 0 | ✅ 静的 | Undo は状態不足で Hide（Undo/Loop）または導線（Paywall）。未実装を disabled で出していない |
| 常設 Utility Button ≤ 7（Chord Card 除く） | ✅ 静的 | Top: Export / Close；Capsule 1；Transport: Undo? / Play / Loop?（条件付き）≤ 5 |
| 横一列 Glyph ≤ 3／Filled CTA = 1 | ✅ 静的 | Transport 行は最大 3、Filled は Play のみ（`CPTransportBar`） |
| 同一 Action 重複 = 0 | ✅ 静的 | Key/BPM/Style/Sound は Capsule→Sheet のみ |
| 未実装 Action 露出 = 0 | ✅ 静的 | Context Menu 未完了分は旧 inline 操作を残置（機能は実装済み） |
| Tap Target ≥ 44×44 | ⚠ 部分 | Retry / Transport / Capsule は確保。一部 IconBtn は hitSlop 依存 → 実機で確認 |

## 3. RETENTION / QUALITY

| Gate | 判定 | メモ |
|---|---|---|
| 初回発音 ≤ 5秒（中央値） | ⏳ 実機 | Starter Progression により空白なし。発音前 Modal = 0 |
| 4Chord 完成 ≤ 60秒 | ⏳ 実機 | Starter は既に 4 コード。編集成功時 hapticSuccess |
| Tap Feedback ≤ 100ms | ✅ 設計 | Haptics + 即時プレビュー（再生中はスキップ） |
| VoiceOver / Dark / Reduce Motion / Dynamic Type | ⏳ / ✅ 部分 | Dark は既存テーマ。Reduce Motion は lift→opacity。VO/DT は実機 |
| Crash / Note stuck / dead-end = 0 | ⏳ 実機 | 音源失敗時は Retry バナー |
| Usability 5人 | 対象外（運用） | 環境整い次第 |

## 4. 機能回帰チェックリスト（実機）

- [ ] play / pause / stop / loop
- [ ] 追加 / 削除 / 複製 / 移動 / 長さ変更
- [ ] Auto-save と再起動復元（Home「続きから編集」）
- [ ] 転調 / Key 変更（Session Sheet）
- [ ] 動画書き出し
- [ ] 音源 prepare 失敗時に Retry で復帰（シミュレート可なら）
- [ ] iPhone SE〜Pro Max レイアウト

## 5. Phase D 実装サマリ（本フェーズで完了したもの）

- Haptics: 選択 / 追加(soft) / 4Chord success / prepare error
- Playhead: 再生中 Card の translateY 浮き + ring（Reduce Motion 時は opacity）
- Starter Progression: `session.startNew()` → jpop-royal @ C
- 復帰 Session: `sessionPrefsRepository` + Home「続きから編集」
- Error Feedback: editor 上部 Retry バナー

## 6. 残課題（Sprint 7 後続 / 実機）

1. Chord Context Menu（Long Press）へ inline 操作を完全移行（Phase C 残）
2. Baseline スクショ/操作動画（Phase A・実機）
3. VoiceOver / Dynamic Type / SE〜Pro Max の実測記録
4. Sprint 6 Step3 Swift 反映のための **EAS rebuild**
5. 5B RevenueCat（APIキー / ASC 商品待ち）

## 7. 総合判定（静的）

**Phase D: PASS（静的）** — Delight 契約のコード実装は揃った。  
**Phase E / Release Gate: CONDITIONAL PASS** — 自動検証パス後に静的 Gate は概ね満たす。数値・アクセシビリティ・端末サイズは**実機チェックリスト未消化**のため、製品リリース前に §4 を埋めること。
