# Extensions（テンション）

**ポリシー:** アボイドノートは候補除外に使わない。実用性・ポップス優先、ジャズ拡張も列挙する。セブンスは別タブ。

表記: `b` = ♭, `#` = ♯。実装の Unicode `♭` とは表示レイヤで正規化してよい。

---

## 1. 共通ルール

- テンション候補は degree 別カタログ（下記）
- 各エントリは `buttonLabel` / `symbol` / `intervals` / 構成音説明を持つ
- MIDI は `intervals` から生成し、表示名と一致させる
- UI 骨格（度数選択 → ピル）は維持。ピル集合のみ拡張

---

## 2. Degree 別カタログ

### I（major）

| buttonLabel | symbol | intervals（推奨コンパクト） | 構成音（C） |
|---|---|---|---|
| maj11 | maj11 | `[0,4,7,11,14,17]` | C E G B D F |
| 6/9 | 6/9 | `[0,4,7,9,14]` | C E G A D |
| maj9(#11) | maj9(#11) | `[0,4,7,11,14,18]` | C E G B D F# |
| maj13(#11) | maj13(#11) | `[0,4,7,11,14,18,21]` | C E G B D F# A |

既存維持: sus4, add9, 6, sus2, maj9, maj13

### ii（minor）

| buttonLabel | symbol | intervals | 構成音（D） |
|---|---|---|---|
| m6/9 | m6/9 | `[0,3,7,9,14]` | D F A B E |
| m9(11) | m9(11) | `[0,3,7,10,14,17]` | D F A C E G |
| m13(9) | m13(9) | `[0,3,7,10,14,21]` | D F A C E B |
| m13(9,11) | m13(9,11) | `[0,3,7,10,14,17,21]` | D F A C E G B |

既存維持: sus*, m(add9), m6, m9, m11, m13

### iii（minor）

| buttonLabel | symbol | intervals | 構成音（E） |
|---|---|---|---|
| add9 | m(add9) | `[0,3,7,14]` | E G B F# |
| 9 | m9 | `[0,3,7,10,14]` | E G B D F# |
| 11 | m11 | `[0,3,7,10,14,17]` | E G B D F# A |
| 13 | m13 | `[0,3,7,10,14,21]` | E G B D F# C# |
| 9(11) | m9(11) | `[0,3,7,10,14,17]` | E G B D F# A |

※ buttonLabel は短く、実際の quality は minor を維持（メジャー3度に化けない）

### IV（major）

I と同型: maj11, 6/9, maj9(#11), maj13(#11) + 既存

### V（dominant）

非オルタード拡張:

| buttonLabel | symbol | intervals | 構成音（G） |
|---|---|---|---|
| 11 | 11 | `[0,5,7,10,14]` | G C D F A（3度省略可） |
| 13(#11) | 13(#11) | `[0,4,7,10,14,18,21]` | G B D F A C# E |

オルタード系は `Altered.md`。

### vi（minor）

| buttonLabel | symbol | intervals | 構成音（A） |
|---|---|---|---|
| 13 | m13 | `[0,3,7,10,14,21]` | A C E G B F# |
| 6/9 | m6/9 | `[0,3,7,9,14]` | A C E F# B |
| 9(11) | m9(11) | `[0,3,7,10,14,17]` | A C E G B D |
| 13(9) | m13(9) | `[0,3,7,10,14,21]` | A C E G B F# |

### vii°（half-dim / dim）

| buttonLabel | symbol | intervals | 構成音（B） |
|---|---|---|---|
| m7b5(9) | m7b5(9) | `[0,3,6,10,14]` | B D F A C# |
| m7b5(11) | m7b5(11) | `[0,3,6,10,17]` | B D F A E |
| m7b5(b13) | m7b5(b13) | `[0,3,6,10,20]` | B D F A G |
| dim7(add9) | dim7(add9) | `[0,3,6,9,14]` | B D F Ab C# |

---

## 3. 表示ルール

- `displayName` = `spelledRoot + symbol`（スラッシュ時は `/bass`）
- `buttonLabel` はタブ内の短い識別子（ユーザー指定表記を優先）
- セブンス（maj7/m7/7/m7b5）はテンションタブに混ぜない
