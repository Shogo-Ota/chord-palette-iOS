# City 教師データ

- スタイル名: City（シティポップ）
- Apple Music プレイリスト URL（参照情報のみ）: https://music.apple.com/jp/playlist/city/pl.u-BNA66X6F1VbRydl
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
| 1 | プラスティック・ラブ | 竹内まりや | （未記入） | |
| 2 | ミライのテーマ | 山下達郎 | （未記入） | |
| 3 | RIDE ON TIME | 山下達郎 | （未記入） | |
| 4 | 真夜中のドア〜Stay With Me | 松原みき | （未記入） | |
| 5 | Remember Summer Days | 杏里 | （未記入） | |
| 6 | Last Summer Whisper | 杏里 | （未記入） | |
| 7 | Sea Line | 角松敏生 | （未記入） | |
| 8 | Summer Connection | 大貫妙子 | （未記入） | |
| 9 | 東京フラッシュ | Vaundy | （未記入） | |
| 10 | NEW ERA | Nulbarich | （未記入） | |
| 11 | Sparkle | iri | （未記入） | |
| 12 | STAY TUNE | Suchmos | （未記入） | |
| 13 | MINT | Suchmos | （未記入） | |
| 14 | NIGHT TOWN | フレンズ | （未記入） | |
| 15 | Ride on Wave | Yogee New Waves | （未記入） | |
| 16 | Peg | Steely Dan | （未記入） | |
| 17 | I Keep Forgettin' | Michael McDonald | （未記入） | |
| 18 | Jojo | Boz Scaggs | （未記入） | |

## 教材として見る伴奏要素

- Maj7 / 9th / 13th
- 転回形
- Rhodes
- ギターカッティング
- 16ビート
- シンコペーション
- 滑らかなベース
- コード間のボイスリーディング
- ブラス
- ストリングス
- 都会的な余白
- 洗練されたダイナミクス

## スタイル全体のメモ

> ラベル: **HYPOTHESIS**（暫定の方向性メモ。曲別聴取分析は未実施＝0件。MEASURED ではない。観点は `listening_analysis_guide.md`）

- テンポ帯の想定: おおむね 95–120 BPM、16ビートの細かい格子
- コードは詰めすぎず、休符とシンコペが都会的な余白を作る
- ベースは滑らか（5度中心）。オクターブポンプは避ける
- 高域のコードワーク・高めレジスタが「洗練」を担う
- Chord Palette への翻訳: `beat16` + soul16、CITY_LINE、octaveShift=1
