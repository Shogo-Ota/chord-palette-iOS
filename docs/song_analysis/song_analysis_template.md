# Measured Song / 聴取メモ テンプレート

- 版: v1.0（2026-08-03）
- 現状: **記入済み曲 = 0**（Source MIDI 未提供・曲別分析未実施）

2 系統ある。混同しないこと。

| 系統 | ラベル | 正典 |
|---|---|---|
| 耳での聴取メモ | `USER_LISTENING` | [`../style_datasets/song_analysis_template.md`](../style_datasets/song_analysis_template.md) |
| Source MIDI 実測 | `MEASURED_SONG` | 本ファイル下部 + [`song_analysis.schema.json`](./song_analysis.schema.json) |

---

## A. 聴取メモ（USER_LISTENING）

簡易フォーマットは style_datasets 側テンプレを使う。  
観点: [`../style_datasets/listening_analysis_guide.md`](../style_datasets/listening_analysis_guide.md)

---

## B. Source MIDI 実測サマリ（MEASURED_SONG）

機械出力 JSON が正。以下は人間可読の表紙。

```markdown
# <songId> — 曲名 / アーティスト

- スタイル: Ballad | Band | City | Dance | R&B
- 層: Measured Song Features
- evidence: MEASURED_SONG
- Source MIDI 台帳 ID:
- 解析日:
- JSON: LocalAnalysis/song_features/<songId>.json

## 権利（必須）
- 購入 / 許諾の確認: verified
- 派生解析: 可
- 再配布: 否（原則。元 MIDI は非同梱）

## 測定サマリ
- BPM / 拍子:
- コード楽器: 音価中央 / 密度 / シンコペ率:
- ベース: ルート率 / キック同期率 / アプローチ有無:
- ドラム: グリッド種 / フィル位置候補:
- タイミング: 全体オフセット / パート差:
- セクション密度: A→サビの変化:

## 抽象化候補（他進行へ移植可）
-

## 曲固有のため捨てるもの（製品禁止）
-

## Design Target への提案（まだ DESIGN_TARGET ではない）
-
```

保存:

- 機械: `LocalAnalysis/song_features/<songId>.json`
- 人間可読要約（任意）: `docs/song_analysis/reports/<style>/<songId>.md`（元 MIDI・生イベント列は書かない）
