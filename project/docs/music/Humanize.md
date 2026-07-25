# Humanize

---

## 1. 定義

機械的グリッドを、聴感上自然な範囲でずらす処理。  
**ランダム再現不能な揺らぎではなく、決定論的（シード付き）を基本**とする（現状踏襲）。

---

## 2. 現状

```swift
humanize(base, seed, amount ≈ 0.07)  // velocity/gain
timingSway(seed, amountBeats)        // onset
```

- Piano 伴奏のみ適用
- Drum なし
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

曲解析から蓄積する特徴:

- timing 分散、velocity 分散、手前/後ろ乗りバイアス  
- **具体ノート列は保存しない**

---

## 4. 制約

- Export と Preview で同一シード戦略 → 結果一致
- ユーザーが 0 にすると完全クオンタイズ
- groove-reviewer が過剰 humanize（聴感破綻）をレビュー
