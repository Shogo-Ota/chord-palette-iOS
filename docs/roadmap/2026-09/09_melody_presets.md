# 09. Melody Presets - 開発設計仕様書

## 1. 目的
メロディ手打ちを導入せず、コード進行上に短いモチーフを自動付加して完成感を上げる。

## 2. 初期Preset
- None
- Simple
- Emotional
- Pop
- Arpeggio
- Motif

## 3. 対象外
- Melody Piano Roll
- Note編集
- 原曲風メロディ生成
- LLM/生成モデルによる自由メロディ

## 4. 生成原則
決定論的・コード相対。
- chord tone priority
- scale tone
- approach note
- avoid-note rules
- phrase start/end
- register range
- motif repetition/variation

## 5. 型案
```ts
export type MelodyPresetId = 'none'|'simple'|'emotional'|'pop'|'arpeggio'|'motif';
export interface MelodyEvent {
  position: number;
  duration: number;
  chordRelativeRole: string;
  octave: number;
  velocity: number;
}
```

## 6. 著作権/安全設計
原曲MIDI/市販MIDIのメロディイベントを製品へ持ち込まない。固有リフをテンプレート化しない。ルールと相対特徴のみ。

## 7. Acceptance Criteria
- 任意進行でクラッシュしない。
- chord change時に重大なavoid-note衝突なし。
- 同一seedで同一出力。
- Noneで既存再生が完全不変。

## 8. KPI
- Melody preset利用率
- Preset使用時のExport率
- Melody動画のretention/save率

## 9. Cursor実装指示
最終段階機能。まずHarmony/Groove/Qualityが安定してから着手。Generatorではなく明示ルールエンジンとして実装し、原曲依存データは使用しない。
