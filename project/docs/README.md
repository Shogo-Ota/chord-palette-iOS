# Chord Palette — 音楽プラットフォーム基盤ドキュメント

本ツリーは大規模アップデート（設計・知識基盤）の成果物である。  
**ランタイム実装の正本コードを置き換える前に、ここを更新する。**

| 文書 | Phase | 内容 |
|---|---|---|
| [ArchitectureReport.md](./ArchitectureReport.md) | 1 | 現状解析 |
| [OSSComparison.md](./OSSComparison.md) | 2 | OSS 比較と採用判断 |
| [music/](./music/) | 3 | **唯一の音楽仕様書** |
| [design/CursorAgentDesign.md](./design/CursorAgentDesign.md) | 4 | Subagent / Rules |
| [design/TensionCatalogDesign.md](./design/TensionCatalogDesign.md) | 5 | テンション追加設計 |
| [design/GrooveEngineDesign.md](./design/GrooveEngineDesign.md) | 6 | Groove Engine |
| [design/ChordDataModelDesign.md](./design/ChordDataModelDesign.md) | 7 | データ構造 |
| [design/TestArchitectureDesign.md](./design/TestArchitectureDesign.md) | 8 | テスト構成 |
| [DeviceTesting.md](./DeviceTesting.md) | 運用 | 実機確認（Dev Client + Metro・低コスト） |
| [design/NativeGrooveBridge.md](./design/NativeGrooveBridge.md) | 実装中 | TS→Native strikes 契約 |

既存の `docs/sprints/` / `docs/design-tokens.md` は UI スプリント用。音楽仕様は `project/docs/music/` を優先する。
