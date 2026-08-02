# RomanNumerals

---

## 1. ダイアトニック（メジャー）

| Index | Label | 品質（triad） |
|---|---|---|
| 0 | I | major |
| 1 | ii | minor |
| 2 | iii | minor |
| 3 | IV | major |
| 4 | V | major |
| 5 | vi | minor |
| 6 | vii° | diminished |

---

## 2. 拡張ラベル

| パターン | 例 | 意味 |
|---|---|---|
| 二次ドミナント | `V7/ii` | ターゲットへの V7 |
| 借用 | `bVII`, `bVI`, `bIII`, `IVm` | 平行短調など |
| バリエーション | `I sus4`, `V 9` | degree + buttonLabel |
| スラッシュ | `I/E` or `I` + bass 再拼写 | on-chord |

---

## 3. 方針

- 永続化の軸は Roman 文字列ではなく `rootOffset`（+ definition id）
- UI の `degreeLabel` は可読性優先。品質を Roman に埋め込むか（`Imaj7`）は **セブンス別タブのため基本は埋め込まない**
- パーサが必要な場合は Tonal `@tonaljs/roman-numeral` を開発検証に使い、実行時は自前サブセットでもよい
