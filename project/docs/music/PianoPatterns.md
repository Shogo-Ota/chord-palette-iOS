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

### 3.1 ストラム感の基準（GT-001 校正後）

| 指標 | GT-001 | 運用 |
|---|---|---|
| クラスタ spread | median 0 / mean 3.2 / p75 6.5 ms | `strumMs` ≈ **3–7** |
| 低音先打ち比 | 0.44 | 低音先行を強制しない |
| Body − Bass | p75 +4 ms | わずかな遅れは可 |

旧仮値（低 +0 / 中 +8 / 高 +15）は **強すぎ**。本教材は同時押し寄り。

### 3.2 リズム感（GT-001）

- onset の **44% が 16 分の e/a** → `sixteenthBeat` 系が本流  
- Bass ノート長 median **0.5 拍**、body median **≈0.25–0.30 拍**  
- inter-onset median **0.25 拍**（16 分グリッド）  
- 意図的な ≥0.5 拍ギャップあり（詰め込みすぎない）

解析チェックリストは `Groove.md` §6.1。詳細は `GroundTruthMidi.md`。
