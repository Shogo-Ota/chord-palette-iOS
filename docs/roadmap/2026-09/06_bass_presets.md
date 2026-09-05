# 06. Bass Presets - 開発設計仕様書

## 1. 目的
手打ちを導入せず、ベースの動きだけを意味のあるプリセットで調整できるようにする。

## 2. 初期Preset
- Root
- Root + 5th
- Octave
- Pop
- Approach
- Syncopated

## 3. 対象外
- Piano Roll
- Note単位編集
- 任意Velocity編集
- MIDIベースライン手入力

## 4. 型案
```ts
export type BassPresetId =
  | 'root'
  | 'root_fifth'
  | 'octave'
  | 'pop'
  | 'approach'
  | 'syncopated';
```

## 5. 実装原則
既存 `planBassLine.ts` の公開契約を監査し、Presetはパラメータ/strategy選択レイヤとして追加。既存Energyの`bassActivityScale`と競合させない。

## 6. ルール
- chord root/functionに追従
- register upper/lower bound
- approachは次コードを参照
- chromatic approachは解決先必須
- kick同期を常時強制しない

## 7. Acceptance Criteria
- 全Presetで任意4コード進行を再生可能。
- Slash chordでbass root interpretationを明示。
- Approachが未解決で終わらない。
- Energy changeでPreset identityが消えない。

## 8. KPI
- Bass preset切替率
- Export率
- Style×Bass preset別SNS performance

## 9. Cursor実装指示
`planBassLine.ts`を最初に監査し、既存design targetを壊さないadapter方式を提案。Preset別fixtureを用意してから実装。
