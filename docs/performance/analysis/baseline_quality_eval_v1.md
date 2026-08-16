# Baseline 品質評価（Ballad @ 90）

- 作成日: 2026-08-03
- データ区分: Baseline イベントは **DESIGN_TARGET** のスナップショット（MEASURED ではない）
- 対象: [`docs/performance/baselines/ballad_C-G-Am-F_90bpm_relaxed_piano_v1.json`](../baselines/ballad_C-G-Am-F_90bpm_relaxed_piano_v1.json)

## 固定条件

| 項目 | 値 |
|---|---|
| 進行 | C – G – Am – F |
| BPM | 90 |
| 拍子 | 4/4 |
| パターン | `relaxed`（Ballad） |
| 音色メタ | piano |
| seed | 20260803 |
| ドラム | on |

## Metrics 要約（pinned Baseline）

| パート | noteCount | vel mean | vel σ | pitch | polyphony | timingDev |
|---|---:|---:|---:|---|---:|---:|
| bass | （partStats） | 高め | — | 低域中心 | 1 | 小 |
| chord | 16 | 70.3 | 6.9 | 50–60 | **2** | 0.006 |
| top | 4 | 66.5 | 6.2 | 59–69 | 1 | 0.006 |
| kick | 4 | 90.3 | 6.4 | 36 | 1 | 0 |
| snare | 4 | 82.8 | 8.6 | 38 | 1 | 0.015 |
| hat | 16 | 54.5 | 8.2 | 42 | 1 | 0.006 |

Integrity: errorCount = 0（整合性は健全）。

## 聴感・構造上の課題（評価）

1. **コード体が薄い** — chord polyphony 平均 2。Ballad で「低音だけ」に聞こえやすい構造的要因。
2. **bassOnly 変化が効きすぎる余地** — `RELAXED_VARIATION.bassOnly` が高いとコード欠落バーが増える。
3. **バスがコードより前に出る** — bass center が chord より高いと、スピーカーでは低音優勢に感じる。
4. **強弱の起伏が控えめ** — chord vel σ ≈ 7。フレーズの抑揚が足りないと機械的に聞こえる。
5. **余白は良い** — hat/kick の疎さ、legato ゲートは Ballad 方向として妥当（HYPOTHESIS と一致）。

## 改善アクション（本パスで実施）

| 変更 | 狙い | ラベル |
|---|---|---|
| `bassOnly` 0.10 → 0.04 | コード欠落バーを減らす | DESIGN_TARGET |
| Ballad chord center 66→68 / bass 74→72、accentDepth↑ | コードをバスより前へ | DESIGN_TARGET |
| City カード `arpeggio`→`beat16` | City Engine＋CITY_LINE を実際に聴かせる | DESIGN_TARGET |
| Band / City velocity 微調整 | キットに埋もれないコード | DESIGN_TARGET |

## 未実施（実機）

- 実機スピーカーでの長時間試聴比較
- Baseline JSON の再ピン（意図的に受け入れるとき `BALLAD_BASELINE_WRITE=1`）
