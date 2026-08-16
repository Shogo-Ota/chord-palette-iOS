# 市販楽曲 MIDI 分析（準備パッケージ）

指示書: **市販楽曲MIDI分析・スタイル抽象化・アプリ反映指示書 v1.0**

## 現状

| 項目 | 状態 |
|---|---|
| Source MIDI | **未提供** |
| Measured Song Features | **0** |
| Style Aggregate | **0** |
| 曲分析の実行 | **しない**（受領後） |

## 文書

| ファイル | 内容 |
|---|---|
| [song_midi_analysis_policy.md](./song_midi_analysis_policy.md) | 目的・層分離・証拠分類・受領条件 |
| [song_analysis_workflow.md](./song_analysis_workflow.md) | Phase 0〜6 手順 |
| [style_aggregation_policy.md](./style_aggregation_policy.md) | 複数曲集約ルール |
| [app_reflection_compliance.md](./app_reflection_compliance.md) | アプリ反映ゲート |
| [song_analysis_template.md](./song_analysis_template.md) | 聴取 / 実測テンプレ |
| [local_layout.md](./local_layout.md) | LocalDatasets / LocalAnalysis |

## スキーマ

| ファイル | 対象 |
|---|---|
| [song_analysis.schema.json](./song_analysis.schema.json) | MEASURED_SONG |
| [style_aggregate.schema.json](./style_aggregate.schema.json) | MEASURED_AGGREGATE |
| [app_profile_manifest.schema.json](./app_profile_manifest.schema.json) | DESIGN_TARGET → App Profile |

## 関連（既存）

- Reference Songs: `docs/style_datasets/*_teacher.md`
- 聴取観点: `docs/style_datasets/listening_analysis_guide.md`
- 一般 MIDI ポリシー: `docs/midi_dataset_policy.md`
