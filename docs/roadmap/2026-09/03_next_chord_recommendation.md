# 03. Next Chord Recommendation - 開発設計仕様書

## 1. 目的
ユーザーの「次に何を置けばよいか」を、理論根拠付きで即座に解決する。

## 2. UX
現在進行の末尾で「次のコード候補」を最大5件表示。
カテゴリ:
- 王道
- エモい
- 浮遊
- 意外
- Jazz

候補はタップ試聴、長押しで理論説明、適用可能。

## 3. 対象外
- LLMによる自由文章ベースの進行生成
- メロディ考慮
- ユーザープロファイル学習（初期版）

## 4. ドメインモデル案
```ts
export type RecommendationMood = 'standard'|'emotional'|'floating'|'surprising'|'jazz';
export interface ChordRecommendation {
  chord: ChordSymbol;
  mood: RecommendationMood;
  rationale: string;
  functionLabel?: string;
  score: number;
}
```

## 5. スコア要素
- tonal function continuity
- cadence probability (design rule)
- common tone / VL cost
- modal interchange bonus
- secondary dominant applicability
- repetition penalty
- complexity budget

## 6. 実装構成
- `src/lib/harmony/recommendation/types.ts`
- `src/lib/harmony/recommendation/candidatePool.ts`
- `src/lib/harmony/recommendation/score.ts`
- `src/lib/harmony/recommendation/recommendNextChord.ts`
- `src/features/editor/nextChord.ts`

## 7. Acceptance Criteria
- Major/minor key双方対応。
- 同一入力/カテゴリで同一順位。
- 候補理由が必ず表示可能。
- key context不明時はUNKNOWNとして保守的候補のみ。
- 既存選択UIを阻害しない。

## 8. KPI
- 候補表示 -> 試聴率
- 試聴 -> 適用率
- 1セッションあたり完成進行数
- 初回ユーザーの進行完成率

## 9. Cursor実装指示
初期版は完全rule-based。既存theory utilitiesを再利用し、重複ロジックを作らない。UI追加前にdomain unit testを完成させる。
