# 「低音だけが鳴る」問題 — 原因調査（v1.01）

- 作成日: 2026-08-03
- 状態: **根因の単一特定は未完了**（低頻度・長時間再生）。仮説の整理と短期対策を記録。

## 既知の事実（コード根拠）

| 事実 | 根拠 |
|---|---|
| 計画側 Note は低音のみではない | Baseline / PerformanceEngine は chord・top・bass・kit を出す。`planNoteMin/Max` で検証可能 |
| ポリフォニー上限 24 声（新アタック優先） | `AudioEngineController.maxChordPolyphony` / `cappedVoiceFrames` |
| 診断 API あり | `audioService.getPlaybackDiagnostics()` / `logPlaybackDiagnostics` |
| Ballad に bass-only バーがある | `RELAXED_VARIATION.bassOnly`（意図的な薄いフレーズ） |
| warmLow ボイシングは低め・薄い傾向 | `VOICING_AESTHETICS.warmLow` |

## 仮説（尤度順）

1. **高（構造）** — Ballad の薄いコード体（poly≈2）＋ bassOnly 変化＋バス音量優位で、内蔵スピーカーでは「低音だけ」に聞こえる。長時間再生バグではなくデザイン寄りの症状。
2. **中（ランタイム）** — ポリフォニー飽和で中高域のテールが間引かれ、残響の長い低音／バスが残る（`cappedVoiceFrames` 増加で検証）。
3. **中** — 音源ロード失敗で一部サンプルが無音、低音レイヤだけ残る（`getDiagnostics` の load 状態）。
4. **低** — JS 計画が低音のみになるバグ（現状の自動テスト・Baseline では未再現）。

## 切り分け手順（実機）

1. 症状発生直後に Metro で `audioService.logPlaybackDiagnostics('bass-only')`。
2. `planNoteMin` / `planNoteMax` が広い → 計画は健全、レンダ／音源側。
3. `cappedVoiceFrames` が急増 → ポリフォニー仮説。
4. plan が低域だけ → JS 生成バグ（再現手順を残す）。

## 本パスで入れた対策

- Ballad `bassOnly` 確率を大幅に下げ、コード欠落を減らす（聴感の「低音だけ」を緩和）。
- Ballad / Band / City のコード中心ベロシティをバスより相対的に前へ。
- `audioService.play` を直列化し、スタイル連打時の古い計画の上書き競合を抑制。

## まだやらないこと

- ネイティブポリフォニー上限の大幅変更（副作用大）
- GMD 由来のドラム値変更（別タスク・保留）
