# 02. Accompaniment Quality Hardening - 開発設計仕様書

## 1. 目的
新機能追加より先に、Chord Paletteの中核価値「コードを置いた瞬間に自然な伴奏になる」を壊す濁り・不自然なvoicing・不整合を体系的に減らす。

## 2. 対象
- Chord tone整合性検査
- Tension availability検査
- Register / close interval collision検査
- Voice-leading regression検査
- Styleごとの演奏結果Golden Test
- Fmaj7等で報告された濁り再発防止

## 3. 対象外
- 新しいEnergy Profile数値の導入
- Style rhythm skeletonの全面変更
- Humanize ms学習
- 市販MIDIイベントの製品同梱

## 4. 品質Gate
生成イベントごとに以下を検証可能にする。
- expected chord-relative role
- actual pitch class
- allowed tension
- register
- simultaneous semitone collision
- accidental non-chord tone

## 5. 実装構成案
- `src/lib/performance/validation/types.ts`
- `src/lib/performance/validation/validateRenderedChord.ts`
- `src/lib/performance/validation/collisionRules.ts`
- `src/lib/performance/validation/goldenProgressions.ts`
- `src/lib/performance/__tests__/qualityRegression.test.ts`

## 6. 重要原則
「短2度は常に禁止」のような単純ルールにしない。
- register
- chord function
- intentional tension
- avoid note
- duration / overlap
を加味する。

## 7. Acceptance Criteria
- Golden progression 30件以上。
- 全Style×Energyでvalidationを実行可能。
- accidental pitch-class mismatch 0。
- 意図しない低音域minor 2nd collisionを検出。
- 既存MEASURED/DESIGN_TARGETを勝手に書き換えない。

## 8. Tests
- Fmaj7 regression fixture
- altered dominant fixture
- sus chord fixture
- slash chord fixture
- maj9/min9 fixture

## 9. KPI
- USER_LISTENING不具合報告件数
- Export後の聴き直し率
- Style別再生完了率

## 10. Cursor実装指示
監査 -> Validation layer追加 -> Golden tests -> 問題箇所特定まで先に実施。修正は原因と影響範囲を提示後に承認を取る。Engine / Energy Profileの設計値は無断変更しない。
