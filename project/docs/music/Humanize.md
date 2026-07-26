# Humanize

---

## 1. 定義

機械的グリッドを、聴感上自然な範囲でずらす処理。  
**ランダム再現不能な揺らぎではなく、決定論的（シード付き）を基本**とする（現状踏襲）。

Accent（意図的な強弱の骨格）とは分離する → `Accent.md`。

---

## 2. 現状

```ts
humanizeGain(base, seed, amount ≈ 0.07)
timingSway(seed, amountBeats)
```

- Piano 伴奏に適用（TS Groove Engine）
- Drum パターン自体への humanize は限定的
- UI / プロジェクト設定なし

---

## 3. 目標プロファイル

```json
{
  "velocityAmount": 0.07,
  "timingAmountBeats": 0.015,
  "swingLink": true,
  "seedStrategy": "hash(bar, part, strokeIndex)"
}
```

スタイル別の目安（**GT-001 は強クオンタイズ** → timing は小さめ）:

| 伴奏 | velocityAmount | timingAmountBeats | 備考 |
|---|---|---|---|
| block | 0.02–0.04 | 0 | |
| eightBeat | 0.06–0.09 | 0.008–0.012 | 旧 0.11/0.018 は大きめ |
| sixteenthBeat | 0.06–0.10 | 0.006–0.010 | GT-001 の主戦場 |
| arpeggio | 0.05–0.07 | 0–0.008 | |

GT-001: onset の median グリッド誤差 ≈ 0。揺らぎを足しすぎない。

曲解析から蓄積する特徴:

- timing 分散、velocity 分散、手前/後ろ乗りバイアス  
- **具体ノート列は保存しない**

---

## 4. 制約

- Export と Preview で同一シード戦略 → 結果一致
- ユーザーが 0 にすると完全クオンタイズ
- groove-reviewer が過剰 humanize（聴感破綻）をレビュー
- 正解 MIDI 由来のバイアスは `Timing.md` の表を優先し、humanize はその周りの微小揺らぎに留める
