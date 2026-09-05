# Chord Palette Update Design Specs

作成日: 2026-09-05

## 目的
Chord Paletteを「ミニDAW」にせず、**コード進行を最速で音楽にし、共有し、市場反応から改善する Musical Idea Accelerator**として強化する。

## 共通原則
- Engine / Energy Profile / 既存UIを承認なしに変更しない。
- MEASURED / MEASURED_AGGREGATE / USER_LISTENING / DESIGN_TARGET / HYPOTHESIS / UNKNOWN を混同しない。
- 市販MIDIの原曲イベント・固有リフ・メロディを製品へ入れない。
- 新機能は既存安定コードの大規模改変より、追加ファイル・追加レイヤを優先する。
- ドメインはReact Native / Expoに依存させない。
- 1機能ずつFeature Flag付きで段階導入し、Analyticsで評価する。

## 推奨実装順
1. Chord Evolution / Reharmonize
2. Accompaniment Quality Hardening
3. Next Chord Recommendation
4. Arrangement / Style Presets
5. Electric Piano Tone
6. Bass Presets
7. Shorts Video Templates
8. Acoustic Guitar Tone
9. Melody Presets

## 今回明確に非採用
- Melody manual input / Piano Roll
- Bass manual input
- DAW型のノート編集、Velocity編集、Quantize、Mixer、Automation

