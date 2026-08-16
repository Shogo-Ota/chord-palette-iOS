# Ballad 教師データ

- スタイル名: Ballad（バラード）
- Apple Music プレイリスト URL（参照情報のみ）: https://music.apple.com/jp/playlist/ballad/pl.u-6mo44ZZHBqLKpva
- 曲目登録日: 2026-08-02（オーナー提供のテキストを正とする）

> 運用ルール:
> - 曲目一覧は本ファイルのテキストを正とする。URL は参照情報であり、教師データ本体として扱わない。
> - MIDI・音声素材の無断取得・収録はしない（`docs/product_vision_v1.01.md` §9 / `docs/implementation_v1.01.md` 作業原則）。
> - 曲は「伴奏の傾向を言語化するための参考」であり、コピーの対象ではない。
> - **本リストは Reference Songs 登録のみ。曲別の伴奏分析は 0 件。** 聴取の観点は
>   [`listening_analysis_guide.md`](./listening_analysis_guide.md)、1曲フォーマットは
>   [`song_analysis_template.md`](./song_analysis_template.md)。表の「未記入」は未分析を意味する。

## 曲目一覧

| # | 曲名 | アーティスト名 | 教材として見るべき伴奏要素 | 備考 |
|---|------|----------------|----------------------------|------|
| 1 | First Love | 宇多田ヒカル | （未記入） | |
| 2 | 奏 | スキマスイッチ | （未記入） | |
| 3 | しるし | Mr.Children | （未記入） | |
| 4 | ハッピーエンド | back number | （未記入） | |
| 5 | ドライフラワー | 優里 | （未記入） | |
| 6 | 雪の華 | 中島美嘉 | （未記入） | |
| 7 | 愛をこめて花束を | Superfly | （未記入） | |
| 8 | Thinking Out Loud | Ed Sheeran | （未記入） | |
| 9 | Everything | MISIA | （未記入） | |
| 10 | Someone Like You | Adele | （未記入） | |
| 11 | 瞳をとじて | 平井堅 | （未記入） | |
| 12 | ハナミズキ | 一青窈 | （未記入） | |
| 13 | やさしさで溢れるように | JUJU | （未記入） | |
| 14 | 愛唄 | GReeeeN | （未記入） | |
| 15 | 三日月 | 絢香 | （未記入） | |
| 16 | All of Me | John Legend | （未記入） | |
| 17 | Your Song | Elton John | （未記入） | |
| 18 | your song | SUPER BEAVER | （未記入） | |

## 教材として見る伴奏要素

- ピアノ主体の伴奏
- アルペジオ
- ブロックコード
- サステイン
- 余白
- ベロシティ変化
- フレーズ終端
- ストリングスの入り方
- Aメロからサビへのダイナミクス
- ボーカルを邪魔しない伴奏密度

## スタイル全体のメモ

> ラベル: **HYPOTHESIS**（暫定の方向性メモ。曲別聴取分析は未実施＝0件。MEASURED ではない。観点は `listening_analysis_guide.md`）

- テンポ帯の想定: おおむね 60–95 BPM のしっとりした進行
- ピアノ主体で、ブロック／アルペジオが長く残り、余白がメロディを支える
- ベースはルート中心で動かしすぎない。低音の連続より「支え」
- サビでもドラムが前に出すぎず、キックは疎、ハットは控えめ
- A→サビは密度とベロシティの上昇で作る（音色追加に頼らない）
- Chord Palette への翻訳: `relaxed` + pop8、legato、BALLAD_WARM、薄いフレーズ終端
