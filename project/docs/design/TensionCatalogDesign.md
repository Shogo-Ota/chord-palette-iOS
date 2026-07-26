# テンション追加設計（Phase 5）

**実装は未着手。** カタログの正は `../music/Extensions.md` / `Altered.md`。

---

## 1. 前提（承認済み方針）

- セブンスは別タブのまま
- アボイドノートは候補制限に使わない
- 実用性・ポップス優先、ジャズ対応
- UI 骨格維持（度数 → ピル）

---

## 2. 現状 → 目標

| 項目 | 現状 | 目標 |
|---|---|---|
| VariationId | 7種固定 | degree 別の定義 ID リスト（拡張自由） |
| マップ | avoid-note 除外 | 実用カタログ全掲 |
| intervals | 一部のみ | 全候補を `INTERVALS` または定義レコードへ |
| 表示 | suffix 連結 | symbol / buttonLabel / displayName 一致 |

---

## 3. 追加一覧（要求どおり）

`ChordDefinitions.md` §5 および `Extensions.md` / `Altered.md` を正とする。

特に新規 suffix 例:

`6/9`, `m6/9`, `maj11`, `maj9(#11)`, `maj13(#11)`, `m9(11)`, `m13(9)`, `m13(9,11)`, `7(b9)`, `7(#9)`, `7alt`, `m7b5(9)`, `dim7(add9)`, …

---

## 4. 一致保証パイプライン（実装時）

```text
KB catalog row
  → ChordDefinition
  → displayName(key)
  → intervals
  → midi pitch classes
  → Jest assert equality (12 keys)
```

未知 suffix の triad フォールバックは **テストで失敗**させる（黙って鳴らさない）。

---

## 5. UI

- ピル増加に耐えられる横スクロール/ラップは既存パターンを維持
- Pro タグは `tags` で制御（既存 isPro と互換）
- buttonLabel はユーザー指定表記を優先

---

## 6. 代替案

| 案 | 内容 | 推奨 |
|---|---|---|
| A | VariationId を増やし DEGREE_VARIATION_SUFFIX を拡張 | 短期・互換高い |
| B | ChordDefinition レコード配列へ移行し degree からフィルタ | 中期・Phase 7 と一致 **推奨** |
| C | Tonal 辞書を実行時ソースにする | 表記制御が難・非推奨 |

---

## 7. 影響範囲（実装時予測）

- `src/data/music.ts`, `src/lib/voicing.ts`, tests, 少数 UI ラベル
- Native 変更なし（MIDI 配列契約のまま）
