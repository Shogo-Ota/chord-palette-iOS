# スタイル集約ポリシー

- 版: v1.0（2026-08-03）
- 対象: Measured Song Features → Style Aggregate → Design Target

## 原則

1. **複数曲必須** — スタイル Aggregate は同一スタイルで 2 曲以上。推奨は 3 曲以上。1 曲だけのときラベルは `MEASURED_SONG` のままに留め、`MEASURED_AGGREGATE` を名乗らない。
2. **中央傾向を優先** — 中央値・四分位を主とし、極端な 1 曲の外れ値でジャンルを定義しない。
3. **固有表現を落とす** — メロディ依存、固有リフ、1 曲だけのフィル位置は Aggregate に入れない（`songSpecific: true` として song features 側に残す）。
4. **再利用可能性** — 任意キー・任意進行へ移植できる記述（相対位置・相対度数・確率・分布）だけを Aggregate 候補にする。
5. **コピー防止** — Aggregate が「その曲セットを再生する」のに十分なら、粒度を粗くする。

## スタイル別の集約フォーカス

聴取観点の詳細は [`docs/style_datasets/listening_analysis_guide.md`](../style_datasets/listening_analysis_guide.md)。集約で優先する軸:

| スタイル | Aggregate で見る主軸 |
|---|---|
| Ballad | コード音価・余白・転回移動量・フレーズ終端密度・サビの vel/音域上昇 |
| Band | キック–ベース同期、8分アクセント、コード音価の短さ、4/8 小節終端変化 |
| City | 16分裏ヒット率、省略ボイシング、短いコード音価、ベース接近、キット補完 |
| Dance | 4つ打ち／シンコ低域、1/4/8 小節変化、スタブ、Humanize の小ささ |
| R&B | パート別レイト、疎なコード、ルート省略、キック–ベース会話、ゴースト |

## Aggregate → Design Target

| やってよい | やってはいけない |
|---|---|
| 分布の中心付近をターゲット帯にする | 曲 A の具体 ms をそのまま本番定数にする |
| スタイル差が付くよう丸める | 全スタイルに同じ値を入れる |
| 再生安定のため上限／下限を掛ける | 「MEASURED だから正しい」と無検証で反映する |

Design Target には必ず参照した Aggregate ID と変換メモを残す。

## 現状

Source MIDI 未提供のため Aggregate 件数は **0**。
