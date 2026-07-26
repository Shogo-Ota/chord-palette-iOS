# ChordDefinitions

コード定義の正。実装はハードコード散在をやめ、本仕様のレコードへ収束させる（設計: `../design/ChordDataModelDesign.md`）。

---

## 1. 必須フィールド

| フィールド | 型（論理） | 説明 |
|---|---|---|
| `symbol` | string | 正規シンボル（例: `maj9(#11)`） |
| `displayName` | template | キー適用後の表示（例: `Cmaj9(#11)`） |
| `buttonLabel` | string | UI ピル短名（例: `maj9(#11)` / `6/9`） |
| `quality` | enum | `major` / `minor` / `dominant` / `diminished` / `halfDim` / `augmented` / `suspended` |
| `intervals` | number[] | ルートからの半音（MIDI の正） |
| `extensions` | string[] | `9`, `11`, `13` 等 |
| `alterations` | string[] | `b9`, `#9`, `#11`, `b13` 等 |
| `degree` | string \| null | 主に使う度数（`I`…）。複数可なら `tags` で |
| `category` | enum | `triad` / `seventh` / `tension` / `altered` / `slash` / `borrowed` / `secondary` |
| `priority` | number | UI 並び（小さいほど先） |
| `tags` | string[] | `pop`, `jazz`, `pro`, … |

---

## 2. 解決ルール

```text
ChordDefinition (key-independent)
  + MajorKey
  → { displayName, degreeLabel?, midiNotes, buttonLabel }
```

- セブンス類は `category: seventh` とし、テンションタブと分離
- テンションは `category: tension | altered`
- `intervals` が空または不正な定義は拒否（フォールバック triad 禁止を将来目標とする）

---

## 3. ダイアトニック基底（メジャー）

| Degree | Triad suffix | Seventh suffix | quality (7th) |
|---|---|---|---|
| I | `''` | `maj7` | major |
| ii | `m` | `m7` | minor |
| iii | `m` | `m7` | minor |
| IV | `''` | `maj7` | major |
| V | `''` | `7` | dominant |
| vi | `m` | `m7` | minor |
| vii° | `dim` | `m7b5` | halfDim |

---

## 4. 現状実装との対応

| 仕様 | 現状コード |
|---|---|
| symbol / buttonLabel | 未実装（`CHORD_VARIATIONS.label` が近似） |
| intervals | `src/lib/voicing.ts` の `INTERVALS` |
| 候補マップ | `DEGREE_VARIATION_SUFFIX` |

移行後は本ファイルと `Extensions.md` / `Altered.md` がカタログの正となる。

---

## 5. Phase 5 追加テンション（degree 別）

詳細 intervals は `Extensions.md` / `Altered.md`。一覧:

| Degree | 追加候補 |
|---|---|
| I | maj11, 6/9, maj9(#11), maj13(#11) |
| ii | m6/9, m9(11), m13(9), m13(9,11) |
| iii | add9, 9, 11, 13, 9(11) |
| IV | maj11, 6/9, maj9(#11), maj13(#11) |
| V | 11, b9, #9, #11, b13, b9b13, #9b13, 13(b9), 13(#11), alt |
| vi | 13, 6/9, 9(11), 13(9) |
| vii° | m7b5(9), m7b5(11), m7b5(b13), dim7(add9) |
