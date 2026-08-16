# 1曲あたりの簡易分析フォーマット

- 制定日: 2026-08-03（オーナー提示）
- 用途: Reference Songs を**実際に聴いたあと**に埋める最小シート
- 注意: 未聴取・未計測の曲は空のままにする。曲名だけから埋めない
- 観点の正典: [`listening_analysis_guide.md`](./listening_analysis_guide.md)

現状（2026-08-03）: **記入済みの曲別シートは 0 件**（伴奏分析 0 件）。

保存先の推奨: `docs/style_datasets/analyses/<style>/<slug>.md`（作成時にディレクトリを用意）。git に載せるのは言語メモのみ。音源・MIDI は載せない。

市販楽曲の**正規 MIDI 実測**パイプライン（未受領・分析 0 件）は
[`docs/song_analysis/`](../song_analysis/README.md) を正とする。

---

```markdown
# 曲名 / アーティスト

- スタイル: Ballad | Band | City | Dance | R&B
- データ区分: Reference Song
- 本メモのラベル: HYPOTHESIS（聴取メモ） | MEASURED（合法データ計測時のみ）
- 聴取日:
- 参照した合法素材: なし / （出典・ライセンス）

## この曲で参考にするもの
- Piano / E.Piano / Bass / Drums / 全体構成

## リズム
- Straight / Swing / Shuffle / Half-time
- 前ノリ / Just / 後ノリ
- 主な刻み：4分 / 8分 / 16分

## コード楽器
- パターン：
- 音域：
- 音価：
- 音数：
- ボイシング移動：

## ベース
- ルート中心 / 動く
- キックとの関係：
- 音価：

## ドラム
- 基本パターン：
- ハイハット：
- フィル位置：

## フレーズ変化
- 4小節目：
- 8小節目：
- Aメロ→サビ：

## Chord Paletteへ入れたい要素
-

## 入れてはいけない固有要素
-
```
