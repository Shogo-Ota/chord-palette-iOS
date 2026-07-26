# Transposition

---

## 1. 二つの操作

| 操作 | 意味 | 実装（現状） |
|---|---|---|
| **移調 (transpose)** | 度数を保ったまま曲の高さを動かす | `transposeProgression` |
| **キー変更 (rebase)** | 絶対ピッチを保ったまま参照キーだけ変える | `rebaseProgression` |

両者を混同しない。UI ラベルも分離を維持する。

---

## 2. スペリング

- シャープキー (`G D A E B`): `#`
- フラットキー + C: `♭`
- 定義の `symbol` は ASCII 寄り（`b9`, `#11`）でもよく、表示時に正規化

---

## 3. 不変条件

移調後も次が不変:

- `rootOffset` 相対関係（transpose ではキーに対する度数）
- `suffix` / definition id
- intervals のピッチクラス集合
- degreeLabel（slash bass 名を除く）

rebase では絶対 MIDI/音名が不変、`rootOffset` がシフトする。

---

## 4. 全12キー

すべての `ChordDefinition` は 12 キーへ機械的に展開可能であること（`noteAt` / 同等関数）。手動のキー別テーブルを増やさない。
