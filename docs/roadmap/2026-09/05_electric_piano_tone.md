# 05. Electric Piano Tone - 開発設計仕様書

## 1. 目的
Piano以外の最初の高ROI音色としてElectric Pianoを追加し、City Pop / Neo Soul / R&B / Lo-fi / Balladでの表現幅を増やす。

## 2. 対象
- Electric Piano instrument preset
- Tone selection UI
- existing MIDI performanceへの音源差し替え
- Export音声/動画への反映

## 3. 対象外
- EP専用Performance Engine
- FM音源エディタ
- ユーザー音源import

## 4. 技術設計
音色IDはperformance patternから分離。
```ts
export type InstrumentToneId = 'piano' | 'electric_piano';
```
Sampler/resource loading、polyphony、release、loop point、velocity layerを検証。

## 5. 品質要件
- mobile CPU/memory予算を設定。
- Note off/releaseでクリックノイズなし。
- 低Velocityでも発音欠けなし。
- Exportとpreviewで音色差異なし。

## 6. Acceptance Criteria
- Piano既存挙動不変。
- EP切替後100ms級でpreview可能（実機測定値を報告）。
- 代表進行10件でvoice count破綻なし。
- Background/foreground復帰で音源リークなし。

## 7. KPI
- Tone利用率
- EP選択時Export率
- EP動画のSNS performance

## 8. Cursor実装指示
まず現行audio module/resource strategyを監査。音色追加をPerformanceEngineに混ぜず、instrument layerとして追加する設計を優先。
