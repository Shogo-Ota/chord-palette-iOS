# 07. Shorts Video Templates - 開発設計仕様書

## 1. 目的
Chord Palette自体をGrowth Engine化し、無加工で投稿できるShortsの種類と検証可能性を増やす。

## 2. 初期Template
- Standard: 現行
- Evolution: Triad -> 7th -> Tension -> Reharm
- Comparison: Original vs Reharmonized
- Instrument: Piano -> EP -> Guitar
- Mood: Standard -> Emotional -> Floating

## 3. 対象外
- 外部動画編集アプリ相当の編集機能
- タイムライン編集
- 自由テキストアニメーションエディタ

## 4. 型案
```ts
export type VideoTemplateId =
  | 'standard'
  | 'evolution'
  | 'comparison'
  | 'instrument'
  | 'mood';

export interface VideoExportRecipe {
  progressionId: string;
  templateId: VideoTemplateId;
  bpm: number;
  styleId: string;
  energy: AccompanimentEnergy;
  variants?: Record<string, string>;
}
```

## 5. Headless設計
最終的にUI操作なしで `VideoExportRecipe -> MP4` を実行可能にする。将来のYouTube自動投稿pipelineの前提。

## 6. Analytics metadata
Export時にrecipe ID、template、progression、BPM、style、energy、toneをsidecar JSON/DBへ保存できる設計。

## 7. Acceptance Criteria
- 9:16 / Shorts安全領域準拠。
- 既存Standard出力互換。
- 同一recipeで決定論的な構成。
- Headless export entrypointを用意可能な層分離。

## 8. KPI
- Template別Export数
- Template別Retention / Viewed vs Swiped Away
- Save / Like / App Store conversion

## 9. Cursor実装指示
現行video-export moduleを監査し、UI state依存を減らす。まず`VideoExportRecipe`をdomain化し、Standardをそのrecipe経由で再現できることを確認してから新Templateを追加。
