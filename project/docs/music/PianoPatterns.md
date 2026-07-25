# PianoPatterns

---

## 1. 現状 ID

| ID | 要約 |
|---|---|
| `block` | コード頭で同時打鍵。微 strum。ring 長め |
| `eightBeat` | bass=4分、body=8分 + 食い |
| `sixteenthBeat` | bass=4分、body=16分（ghost/食い） |
| `arpeggio` | bass sustain、body 16分アルペジオ |

---

## 2. パターン記述の目標形

データ駆動の stroke 列:

```json
{
  "id": "eightBeat",
  "strokes": [
    { "part": "bass", "beat": 0, "dur": 1, "vel": 0.85 },
    { "part": "body", "beat": 0, "dur": 0.5, "vel": 0.8, "strumMs": 5 },
    { "part": "body", "beat": 0.5, "dur": 0.45, "vel": 0.7, "look": -0.02 }
  ]
}
```

Swift の `switch` 直書きから、この JSON/TS 定義の消費へ移行する（設計書参照）。

---

## 3. Pedal / Strum

- Pedal: 現状は `ringCap`（疑似）。将来 CC64 プロファイルを任意追加
- Strum: ギター風ではなくピアノの軽いロールとして維持可
