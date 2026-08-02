# MIDI 教材の推奨入手先と利用ルール

- 制定日: 2026-08-02（オーナー指示）
- 位置づけ: `docs/midi_dataset_policy.md` の下位文書。取得・登録の実務ルールは同ポリシーと
  権利台帳（`docs/style_datasets/midi_registry.json`）に従う。
- 注記: 本文中の「Code Palette」は製品「Chord Palette / コードパレット」を指す。

伴奏研究用 MIDI を探す場合は、**無差別な Web 検索を行わず**、まず以下の公式・正規販売元を候補とする。

## 優先度 A: プロ演奏由来の汎用伴奏 MIDI

### Toontrack EZkeys MIDI

- 公式: https://www.toontrack.com/product-category/ezkeysline/ezkeys-midi/
- 用途: ピアノ / エレピ / コードボイシング / アルペジオ / フレーズ構成 / Humanize / ベロシティ / 曲構成
- ジャンル別に整理されたプロ演奏由来のピアノ・キーボード MIDI。**Ballad、City、R&B、Band の教材候補として優先**する。

### Toontrack EZbass MIDI

- 用途: ベースパターン / 経過音 / アプローチノート / ベースの音価 / ドラムとの噛み合わせ

### Toontrack Drum MIDI Packs

- 公式: https://www.toontrack.com/product-category/midipacks/
- 用途: キック / スネア / ハイハット / フィル / ベロシティ / Humanize / 4小節・8小節単位の変化

## 優先度 A: ドラム MIDI

### Groove Monkee

- 公式: https://groovemonkee.com/
- 用途: 生ドラム / Funk / Rock / R&B / Dance / Electronic / Groove 解析

> ロイヤリティフリー表記があっても、**アプリへの再配布可否と、解析・派生パターン利用可否は製品ごとに確認**すること。

## 優先度 B: 自動伴奏の構造研究

### Band-in-a-Box / PG Music MIDI Styles

- 公式: https://www.pgmusic.com/ / https://www.pgmusic.com/addons.styles.php
- 用途: コードから伴奏を生成する構造 / ピアノ・ベース・ドラム・ギターの役割分担 / Straight・Swing / Intro・Main・Fill・Ending / スタイル単位のパターン設計
- **特定楽曲の再現ではなく、伴奏スタイルの構造研究に利用**する。

## 優先度 B: 市販曲の分析参考

### ヤマハ ミュージックデータショップ

- 公式: https://yamahamusicdata.jp/
- 用途: J-POP のアレンジ構造 / 市販曲の MIDI 表現 / パート構成 / ベロシティ / ボイシング / フレーズ変化
- 市販曲 MIDI は、購入してもアプリへの収録・再配布が許可されるとは限らない。**原則として内部研究用**とし、利用規約を必ず確認する。

## 優先度 C: 自作・独自生成データ

**最も安全で、最終的なアプリ資産として優先度が高い。**

- 自分で打ち込んだ MIDI
- 演奏者へ依頼して制作した MIDI
- Code Palette 用に生成したオリジナル MIDI
- 利用許諾を明確に取得した MIDI
- パブリックドメイン楽曲を独自演奏した MIDI

最終的にアプリへ組み込むパターンは、可能な限りこの区分で作成すること。

## 禁止事項

- 出所不明の無料 MIDI サイトから無断ダウンロードする
- 市販曲 MIDI をそのままアプリへ収録する
- 購入 MIDI をそのまま再配布する
- 特定曲を容易に再現できる長いフレーズを保存する
- メロディや特徴的なリフを抽出して再利用する
- ライセンスが不明な素材を自動取得する

## 取得時に記録する情報（権利台帳の必須項目）

MIDI を登録する際は、以下を必ず記録する（スキーマの正は
`src/lib/performance/library/ingest/registry.ts` の `RightsRecord`）。

- `sourceName` — 入手元名（例: Toontrack）
- `sourceURL` — 入手元 URL
- `productName` — 製品名（例: EZkeys MIDI "Ballads"）
- `purchaseDate` — 購入日（自作は空欄可）
- `licenseType` — ライセンス種別
- `allowedUsage` — 許可されている用途
- `redistributionAllowed` — 再配布可否
- `commercialUseAllowed` — 商用利用可否
- `derivativeUseAllowed` — 派生利用（解析・抽象化パターン作成）可否
- `verificationStatus` — 確認状態
- `notes` — 備考

ライセンスが確認できない場合は `verificationStatus = "manual_review_required"` とし、
**解析対象から除外**する。また、`derivativeUseAllowed` が確認できない素材は
（研究の聴取参考には使えても）パイプラインへの登録はできない。

## 基本方針

市販 MIDI は「研究教材」であり、そのまま製品資産ではない。
**製品へ搭載するのは、複数教材から共通項を抽出し、十分に抽象化して新規作成した
オリジナル伴奏パターン**とする。特定曲のコード進行、メロディ、リフ、フレーズを再現しないこと。

## 使い分け

| 対象 | 入手先 |
|---|---|
| ピアノ・エレピ | EZkeys |
| ドラム | Toontrack Drum MIDI / Groove Monkee |
| ベース | EZbass |
| 伴奏全体の構成 | Band-in-a-Box |
| J-POP の参考分析 | ヤマハ（内部研究用） |
| アプリ搭載用の最終データ | 自作または正式に許諾された MIDI |

## 初期構成の推奨（コスト効率）

EZkeys を 1〜2 パック、ドラム MIDI を 1 パック、残りは自作。
大量購入より、**各スタイルで代表パターンを 3〜5 個ずつ作り、聴感評価しながら増やす**方が
Code Palette には合っている。
