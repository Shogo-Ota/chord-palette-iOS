# コードデータ構造改善設計（Phase 7）

---

## 1. 目標

ハードコード散在をやめ、キー非依存の定義レコードから全12キーへ自動展開する。

必須フィールド:  
`symbol`, `displayName`, `buttonLabel`, `quality`, `intervals`, `extensions`, `alterations`, `degree`, `category`, `priority`, `tags`

---

## 2. 提案モデル

```ts
type ChordQuality =
  | 'major' | 'minor' | 'dominant' | 'diminished'
  | 'halfDim' | 'augmented' | 'suspended' | 'other';

type ChordDefinition = {
  id: string;                 // stable, e.g. "maj9_sharp11"
  symbol: string;             // "maj9(#11)"
  buttonLabel: string;        // UI pill
  displayNameTemplate?: string; // default: "{root}{symbol}"
  quality: ChordQuality;
  intervals: number[];        // sole source for MIDI pcs
  extensions: string[];
  alterations: string[];
  degree: string | string[] | null;  // "I" | ["I","IV"]
  category: 'triad' | 'seventh' | 'tension' | 'altered' | 'slash' | 'borrowed' | 'secondary';
  priority: number;
  tags: string[];             // pop, jazz, pro, free…
};

type ResolvedChord = {
  definitionId: string;
  key: MajorKey;
  displayName: string;
  buttonLabel: string;
  degreeLabel: string;
  rootOffset: number;
  bassOffset?: number;
  midiNotes: number[];
  pitchClasses: number[];
};
```

---

## 3. 解決フロー

```text
ChordDefinition
  + degree context (rootOffset)
  + MajorKey
  → spell root/bass
  → displayName / degreeLabel
  → midiNotes = register + intervals
```

永続化（後方互換）:

```ts
ChordEvent {
  definitionId?: string;  // NEW preferred
  rootOffset: number;     // keep
  suffix?: string;        // legacy bridge → definitionId
  ...
}
```

legacy `suffix` は起動時/ロード時に `definitionId` へマップ。

---

## 4. 配置（提案）

```text
src/lib/theory/definitions/
  catalog.ts               … ChordDefinition[]
  types.ts                 … ChordDefinition / ChordQuality
  index.ts                 … intervalsForChord（id 優先・suffix フォールバック）
project/docs/music/*       … 人間可読の正（カタログと同期）
```

`src/lib/voicing.ts` は自前の `INTERVALS` を持たず、カタログに解決を委譲する。
`src/data/music.ts` はライブラリカードに `definitionId` を付与する。

---

## 5. なぜ既存改変が必要か

- `INTERVALS` と `DEGREE_VARIATION_SUFFIX` と表示名が三重管理で一致保証できない
- Phase 5 の大量テンション追加をハードコードで続けると破綻する
- テストを「定義レコード単位」で回すため

最小化方針: **新規 `src/lib/theory/definitions/` を追加**し、`voicing.ts` はそこへ委譲するだけに留める。
`definitionId` は optional とし、id が無い既存プロジェクトは `suffix` で従来どおり解決する。

---

## 6. 代替案

| 案 | 内容 | 評価 |
|---|---|---|
| A | 既存 maps を肥大化 | 非推奨 |
| B | 自前 ChordDefinition **推奨** | 制御・テスト容易 |
| C | Tonal 辞書を正にする | UI 表記・Pro タグ制御が弱い |

---

## 7. 影響範囲

- 型、music データ層、voicing、tests、（薄い）editor 呼び出し
- Native 変更なし
