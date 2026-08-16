# 教師 MIDI の取得・登録ポリシー

- 制定日: 2026-08-02（オーナー指示）
- 適用範囲: `docs/style_datasets/` の全教師データ、`src/lib/performance/library/` への登録、および将来の MIDI 収集・解析作業すべて
- 関連文書: `docs/product_vision_v1.01.md` §9 / `docs/implementation_v1.01.md` 作業原則 / `docs/engine_specs/ballad_engine_spec.md` §13

## 厳守事項（MIDI を自動取得する場合）

1. **著作権・利用規約を確認できない MIDI をダウンロードしない。**
2. **市販曲の無断配布 MIDI を収集しない。**
3. **アプリへ元 MIDI をそのまま収録しない。** 登録は完全相対形式（`LibraryPattern`）への変換後のみ。
4. **出典・ライセンス・用途を記録する。** 記録のないデータは教材として無効。
5. **合法性が不明な場合は取得せず「要手動確認」とする。** 判断を機械に委ねない。
6. **MIDI が見つからなくても処理を止めない。** 未取得は正常系として扱い、後続の曲へ進む。
7. **曲名だけから実演内容を断定しない。** 未解析の記述はすべて仮説と明記する。

## 登録可能なソースの条件（ballad_engine_spec §13 と同一）

1. オーナー自身の演奏・打ち込みによるオリジナル伴奏パターン（特定曲のコピー採譜は不可）
2. 明示的ライセンスで再利用可能な MIDI（CC0 / CC-BY 等。帰属表示は provenance に記録）
3. パブリックドメイン楽曲の、権利上問題のない打ち込み
4. 購入・許諾済みで、アプリ組み込みが許される商用 MIDI ライブラリ（ライセンス文言の確認必須）

## 開発の優先順位（オーナー指示）

最初に作るのは MIDI 収集ツールではなく、**合法的な MIDI を登録・解析できる
データ構造と解析パイプライン**である。収集の自動化はその後に検討する。

## ステータス管理

登録エントリは必ず `verificationStatus` を持つ。

| ステータス | 意味 |
|---|---|
| `verified` | 出典・ライセンス確認済み。教材として使用可 |
| `manual_review_required` | 合法性が不明（要手動確認）。**解析対象に含めない** |
| `rejected` | 確認の結果、使用不可と判断。記録のみ残す |

さらに、`verified` であっても `derivativeUseAllowed`（派生利用可否）が false の素材は
内部聴取参考に留め、パイプラインへ登録しない。

## 推奨入手先（2026-08-03 更新）

**初期前提はユーザー自作 MIDI ではない。** 公式配布され、ライセンス上
商用利用・解析・派生データ生成が可能な人間演奏データセットを優先する。

1. Groove MIDI Dataset（ドラム）— `docs/data_collection/gmd_acquisition.md`
2. ピアノ／エレピ／ベースの公開候補 — `docs/data_collection/public_accompaniment_datasets.md`
3. **正規購入・許諾済みの市販楽曲 MIDI**（ユーザー提供・内部分析のみ）—
   `docs/song_analysis/`（受領前は文書・スキーマ準備のみ。曲分析は MIDI 到着後）
4. ライセンス不明・NC・著作権混入リスクがあるデータは使用しない
5. 適切な公開データが無い場合に限り、商用ライブラリ購入・演奏依頼・自作を代替案とする

従来の `docs/midi_sources.md`（Toontrack 等）は代替経路として残す。

## スタイル別ロードマップ（オーナー指示 2026-08-02）

Ballad を先行し、その後**同じ形式で 1 スタイルずつ**進める。

1. Ballad（仕様書: `docs/engine_specs/ballad_engine_spec.md` — 作成済み）
2. Band
3. Dance
4. R&B
5. City

各スタイルとも「教師データ → 分析仕様書 → 教材 MIDI 登録・解析 → エンジン実装 → 検証」の順。

## 権利台帳（`docs/style_datasets/midi_registry.json`）

教材 MIDI 1 ファイルにつき 1 エントリ。スキーマは
`src/lib/performance/library/ingest/registry.ts` の `MidiRegistryEntry` が正。

- `id` / `name` — 台帳内で一意な ID と表示名
- `style` / `instrumentRole` / `sourceType` / `usage`（こちらの利用目的）
- `rights` — 取得時に必ず記録する権利情報（`docs/midi_sources.md` の 11 項目）:
  `sourceName` / `sourceURL` / `productName` / `purchaseDate` / `licenseType` /
  `allowedUsage` / `redistributionAllowed` / `commercialUseAllowed` /
  `derivativeUseAllowed` / `verificationStatus` / `notes`。
  自作素材（`sourceType: 'original'`）のみ URL・製品名・購入日を省略できる
- `file` — ローカルの MIDI パス（`assets_dev/midi_teacher/` 配下、**git 管理外**）
- `annotation` — このパターンが演奏されたコード（ルート pitch class と構成音インターバル）、
  拍子、小節数、BPM 帯、リズムフィール、タグ。**コードの自動検出は行わず手動で記載する**

## 解析パイプラインの実行方法

```bash
# 台帳の verified エントリを一括で相対化し、
# docs/performance/library/ にパターン JSON とレポートを出力する
MIDI_INGEST=1 npx jest midiIngest
```

- 元 MIDI はリポジトリ・アプリに入らない。出力されるのは完全相対形式（`LibraryPattern`）のみ
- コード外音は v1 では相対形式に写せないため**登録から除外し、除外数をレポートに記録**する
- ファイル欠落・パース失敗はエラーで止めず、レポートに理由を残して次のエントリへ進む
