# 04. Arrangement / Style Presets - 開発設計仕様書

## 1. 目的
Styleそのものを増殖させず、「同じStyleをどう鳴らすか」の高レベルプリセットで即時バリエーションを提供する。

## 2. 例
Ballad:
- Sparse Piano
- Emotional
- Cinematic
- Singer-Songwriter

City Pop:
- Smooth
- Funky
- Night Drive

Rock:
- Pop Rock
- Pop Punk
- Alternative

## 3. 設計原則
Presetは `Style + existing Energy + arrangement overrides` の束。
既存Energy Profileの意味を変えない。

## 4. 型案
```ts
export interface ArrangementPreset {
  id: string;
  styleId: StyleId;
  labelJa: string;
  allowedEnergy: AccompanimentEnergy[];
  overrides: {
    instrumentId?: string;
    bassPresetId?: string;
    drumPresetId?: string;
    registerBias?: number;
    densityBias?: number;
  };
}
```

## 5. Hard Gate
Energy Profile値をPreset側で上書きしない。Preset固有値は別レイヤとしてapply順序を明文化。

## 6. Acceptance Criteria
- 既存Styleの音がPreset未選択時に完全不変。
- Preset切替がリアルタイムpreview可能。
- 1 Styleあたり最大3-4 presetから開始。

## 7. KPI
- Preset切替率
- Export率
- Style別利用分散

## 8. Cursor実装指示
apply orderを先に監査し、`Style -> Energy -> ArrangementPreset` か別順かを現行実装と整合させて設計案提出。勝手にEngineへ差し込まない。
