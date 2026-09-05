# 01. Chord Evolution / Reharmonize - 開発設計仕様書

## 1. 目的
ユーザーが作った進行を、ワンタップで **Simple -> Rich -> Advanced** に発展させる。Chord Palette固有の体験とShorts用コンテンツ生成を同時に強化する。

## 2. 対象
- Triad -> 7th化
- 7th -> Tension付加
- On Chord化
- Secondary Dominant挿入/置換
- Passing Diminished
- Borrowed Chord（同主調借用）
- Tritone Substitute / 代理コード
- Voice-leadingを悪化させない候補順位付け

## 3. 対象外
- AI自由生成による進行全面作り替え
- 原曲模倣
- メロディ連動リハーモナイズ
- Engine / Energy Profile変更

## 4. UX
進行全体または任意コード選択時に「進化」アクションを表示。

### Level
- L0 Original
- L1 7th
- L2 Tension
- L3 Reharm

各候補は「変更前 -> 変更後」「理論ラベル」「試聴」「適用」「Undo」を持つ。

## 5. ドメインモデル案
```ts
export type EvolutionLevel = 'original' | 'seventh' | 'tension' | 'reharm';
export type ReharmTechnique =
  | 'add_seventh'
  | 'add_tension'
  | 'slash_chord'
  | 'secondary_dominant'
  | 'passing_diminished'
  | 'borrowed_chord'
  | 'tritone_substitute';

export interface EvolutionCandidate {
  before: ChordSymbol[];
  after: ChordSymbol[];
  technique: ReharmTechnique;
  explanationJa: string;
  score: number;
  evidence: 'RULE_BASED' | 'DESIGN_TARGET';
}
```

## 6. 実装構成
追加候補:
- `src/lib/harmony/evolution/types.ts`
- `src/lib/harmony/evolution/rules.ts`
- `src/lib/harmony/evolution/generateCandidates.ts`
- `src/lib/harmony/evolution/scoreCandidates.ts`
- `src/features/editor/chordEvolution.ts`

既存のコード解析/voiceLeading utilityは参照のみ。改変が必要なら別承認。

## 7. Candidate scoring
初期版は決定論的ルール。
- key適合
- chord function整合
- voice-leading cost
- tension availability
- alteration collision penalty
- progression continuity

ブラックボックスLLMを生成器として使わない。

## 8. Hard Gate
- 既存進行を自動上書きしない。
- 適用前に必ずPreview。
- 4音以上の近接配置で短2度衝突等が生じる場合はvoicing側で検査。
- Engine変更は禁止。

## 9. Acceptance Criteria
- 主要ダイアトニック進行20種でクラッシュ0。
- L1は100%決定論的に7th候補を返す。
- L2/L3は各コードに0-3候補。
- Undoで完全復元。
- 同一入力は同一出力。
- theory labelが候補ごとに表示される。

## 10. Tests
- Unit: 各techniqueの生成規則
- Property: key外音が意図せず混入しない
- Snapshot: 代表進行候補
- Regression: 既存editor/playbackへの影響なし

## 11. KPI
- Evolution起動率
- Preview -> Apply率
- Apply後の再生回数
- Evolution使用動画のShorts retention/save率

## 12. Cursor実装指示
1. まず関連コードを監査し、変更対象/対象外/依存関係を列挙。
2. Engine / Energy Profileは変更しない。
3. domain-firstで`src/lib/harmony/evolution/`を追加。
4. UIはFeature Flag下で最小実装。
5. 既存進行を破壊しないUndoを必須化。
6. Unit testを追加し、テスト結果を報告。
7. 実装前に設計差分を提示し承認待ち。
