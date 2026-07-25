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

## 2. パターン記述（実装）

正本（TS）: `src/lib/groove/pianoPatterns.ts` + `compilePiano.ts`  
Native（`AudioEngineController.buildChordStrikes`）は移行完了まで並行。次段で renderer のみに縮小する。

```ts
// eightBeat のレイヤ例（抜粋）
{ part: 'bass', strokes: [{ beat: 0, vel: 1 }, …], nominalRingBeats: 0.95 }
{ part: 'body', strokes: [{ beat: 0.5, vel: 0.58, look: 0.04 }, …], strumSec: 0.005, sparkle: true }
```

---

## 3. Pedal / Strum

- Pedal: 現状は `ringCap`（疑似）。将来 CC64 プロファイルを任意追加
- Strum: ギター風ではなくピアノの軽いロールとして維持可
