# 市販楽曲 MIDI 分析ポリシー

- 版: v1.0（2026-08-03）
- 上位指示: 市販楽曲MIDI分析・スタイル抽象化・アプリ反映指示書 v1.0
- 関連: [`docs/midi_dataset_policy.md`](../midi_dataset_policy.md)、[`app_reflection_compliance.md`](./app_reflection_compliance.md)

## 0. 目的

ユーザーが後から提供する**正規購入済み・許諾済み**の市販楽曲 MIDI を、Chord Palette の伴奏品質改善のための**内部分析教材**として使う。

目的は原曲の再現ではない。

1. MIDI から伴奏の構造・演奏特性を客観的に測定する
2. 楽曲固有の表現と、ジャンル横断で使える伴奏原理を分離する
3. 複数曲の共通傾向を Ballad / Band / City / Dance / R&B へ集約する
4. 集約結果を Chord Palette 独自の伴奏生成ルールへ変換する
5. 元 MIDI や原曲固有フレーズをアプリへ収録しない
6. 各実装値の根拠と変換経路を追跡可能にする

## 1. 禁止事項（製品）

- 原曲のコピー機能を作らない
- 曲名を指定して原曲風伴奏を生成する機能を作らない
- 原曲 MIDI のコードだけを差し替えて再利用しない
- メロディ、固有リフ、特徴的なフィルを製品へ持ち込まない
- アプリが生成するのは Chord Palette 独自の伴奏とする

## 2. データ層の分離

| 層 | 名前 | 意味 | 製品同梱 |
|---|---|---|---|
| 1.1 | **Reference Songs** | 74 曲プレイリスト。方向性・購入候補・聴感妥当性の確認用 | 曲名リストのみ（既存 teacher md） |
| 1.2 | **Source MIDI** | 正規購入・許諾済み MIDI（ユーザー提供） | **不可** |
| 1.3 | **Measured Song Features** | 1 曲から測定した特徴 | 統計・言語要約のみ可（元イベントは非同梱方針） |
| 1.4 | **Style Aggregate** | 複数曲の共通傾向 | 可（集約値） |
| 1.5 | **Engine Design Target** | Aggregate を参考にした Chord Palette 設計値 | 可 |
| 1.6 | **App Profile** | アプリ組み込み用の独自規則 | 可（原曲復元情報を含めない） |

Reference Songs の曲名だけでは演奏内容を解析済みと扱わない。

**現時点（MIDI 未提供）: Measured Song Features = 0。曲分析は行わない。**

## 3. 証拠分類（必須ラベル）

すべての分析記述・数値・実装値に付ける。

| ラベル | 意味 |
|---|---|
| `MEASURED_SONG` | 特定 Source MIDI からの実測 |
| `MEASURED_AGGREGATE` | 複数 Source MIDI の集約 |
| `USER_LISTENING` | ユーザーが実際に聴いて記録した評価 |
| `DESIGN_TARGET` | Chord Palette 用に設計した値 |
| `HYPOTHESIS` | 一般知識や未検証の推測 |
| `UNKNOWN` | 根拠を持って判断できない |

禁止:

- `HYPOTHESIS` を MEASURED 系と表現する
- 1 曲の測定値をスタイル全体の確定値と表現する
- 実装済みであることと、原曲から測定済みであることを混同する

## 4. Source MIDI 受領条件

台帳（`docs/style_datasets/midi_registry.json` または本パイプライン用台帳）に少なくとも次を記録するまで解析しない。

- 取得元・製品名・購入日または許諾日
- ライセンス種別 / 許容用途
- `commercialUseAllowed` / `derivativeUseAllowed` / `redistributionAllowed`
- `verificationStatus: verified`
- ローカルパス（`LocalDatasets/CommercialSongMidi/...`、git 外）

無断配布・ライセンス不明・NC のみ・再配布禁止で派生解析も禁じる契約の素材は解析対象にしない。

## 5. コミット方針

| コミットしてよい | コミットしない |
|---|---|
| 本ディレクトリの方針・スキーマ・空のレポート枠 | `*.mid` / `*.midi` |
| Style Aggregate / App Profile（原曲非復元） | `LocalDatasets/` 配下すべて |
| 権利台帳のメタ（パスは相対・中身なし） | `LocalAnalysis/event_cache/` の生イベント大量ダンプ（任意でローカルのみ） |

## 6. 聴取観点との関係

耳で聴く観点は [`docs/style_datasets/listening_analysis_guide.md`](../style_datasets/listening_analysis_guide.md)。  
ラベルは `USER_LISTENING`。MIDI 実測（`MEASURED_SONG`）と混同しない。
