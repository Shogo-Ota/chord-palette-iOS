# Theory — Chord Palette 音楽理論の正

**Status:** Canonical  
**Scope:** メジャーキー中心のポップス実用理論。ジャズ拡張を許容。  
**Non-goals:** 厳密な古典和声の完全実装、アボイドノートによる候補制限。

---

## 1. 位置づけ

本ディレクトリ `project/docs/music/` は Chord Palette における **唯一の音楽仕様書** である。

- 実装・UI・テスト・エージェントレビューはすべてここに従う
- 実装前に必ず本ディレクトリを更新する
- コード内コメントや Sprint 文書と矛盾する場合、**本ディレクトリが優先**（要件書との矛盾は Issue 化し承認を取る）

---

## 2. 基本方針

| 方針 | 内容 |
|---|---|
| キー | MVP は **12 メジャーキー**。マイナーキーは将来拡張 |
| 度数 | ダイアトニックは I–vii°。借用・二次ドミナントを追加カタログで扱う |
| セブンス | **別タブ / 別トグル**（トライアド主表示と混在させない） |
| テンション | **アボイドノートは考慮しない**。実用性・ポップス優先、ジャズも提供 |
| 表記 | `displayName`（音名+品質）と `degreeLabel`（Roman）を分離 |
| 音響 | `intervals`（半音配列）が MIDI の唯一の正。表示と必ず一致 |
| 伴奏 | 原曲コピー禁止。演奏スタイル / Humanize / Groove / Voicing の **抽象特徴のみ** を蓄積 |

---

## 3. ピッチモデル

```text
pitchClass = (tonicPc + rootOffset) mod 12
MIDI body  = registerRoot + intervals[i]
```

- `rootOffset`: トニックからの半音（永続化の軸）
- `suffix` / `quality` / `symbol`: 人間可読な品質。内部では `ChordDefinition` に解決
- スペリング: シャープキーは `#`、フラットキーは `♭`（`Transposition.md`）

---

## 4. 機能分類

| Function | 度数（ダイアトニック） |
|---|---|
| tonic | I, iii, vi |
| subdominant | ii, IV |
| dominant | V, vii° |

借用・二次ドミナントは個別定義の `function` を持つ。

---

## 5. 関連ドキュメント

| 文書 | 内容 |
|---|---|
| `ChordDefinitions.md` | 定義レコードとカタログ |
| `Intervals.md` | 音程 |
| `Extensions.md` / `Altered.md` | テンション・オルタード |
| `Voicing.md` | ボイシング |
| `RomanNumerals.md` | 度数表記 |
| `Scale.md` | スケール |
| `Transposition.md` | 移調・キー変更 |
| `Groove.md` 以下 | 伴奏・グルーヴ |

---

## 6. 変更ルール

1. 理論・候補・音程を変える PR は、先に本ディレクトリを更新する  
2. `music-theory-reviewer` が差分をレビューする（Phase 4）  
3. 全12キー × 表示 × intervals × MIDI の一致テストを更新する（Phase 8）
