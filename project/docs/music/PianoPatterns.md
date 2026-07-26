# PianoPatterns

---

## 1. 現状 ID

ユーザーが選ぶのは **伴奏パターン 5 種**（`AccompanimentPattern`）。`eightBeat` /
`sixteenthBeat` は引退 ID で、読み込み時に `normalizeAccompaniment` が Natural /
Driving へ移行する。

| ID | 要約 | 解決経路 |
|---|---|---|
| `block` | コード頭で同時打鍵。微 strum。ring 長め | StylePreset 直結 |
| `arpeggio` | bass sustain、body 16 分アルペジオ | StylePreset 直結 |
| `natural` | GT-000 由来の 4 分ボディ + 裏拍ベース | Feel 層 |
| `driving` | テンポ / ドラムで 8 or 16 を選び、食いと上声を足す | Feel 層 |
| `relaxed` | Ballad ベース。legato・後ノリ・3 拍目に 3rd | Feel 層 |

### 1.1 サブバリエーション

各パターンは複数の「弾き方」を持ち、ユーザーが選ぶ。正本は
`src/lib/performance/variants/catalog.ts`。**各パターンの 1 番目は
バリエーション導入前の音そのもの**で、既定値かつ差分ゼロ。保存済みプロジェクトの
音は変わらない。

| パターン | バリエーション |
|---|---|
| Block | **Hold** / Half / Push / Stab |
| Arpeggio | **Up & Down** / Up / 8th / Broken |
| Natural | **おまかせ**（3 種を 4 小節ごと自動ローテーション）/ Steady / Sparse / Dense |
| Driving | **おまかせ**（8/16 自動）/ 8 Beat / 16 Beat / Push |
| Relaxed | **Ballad** / Sustain / Slow Arp |

バリエーションは骨格を差し替えるのではなく **差分を重ねる**（`StyleRefinement`）。
音色・テンポ・ドラムグルーヴには触れない — それらは別の選択軸。

---

## 2. パターン記述（実装）

正本（TS）: `src/lib/performance/styles/`（StylePreset）+ `PerformanceEngine.ts`  
Feel（Natural / Driving / Relaxed）は `src/lib/performance/feel/` で StylePreset に解決される。  
サブバリエーションは `src/lib/performance/variants/` で、その結果に最後に重なる。

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

- onset の **44% が 16 分の e/a** → 16 分駆動が本流  
- Bass ノート長 **0.29–0.63 拍**（median 0.5）、body **0.21–0.50 拍**（median 0.30）。
  音域で 1.7 倍違うので、gate はトラック別に持つ（`GateSpec.byTrack`）  
- inter-onset median **0.25 拍**（16 分グリッド）  
- 意図的な ≥0.5 拍ギャップあり（詰め込みすぎない）

解析チェックリストは `Groove.md` §6.1。詳細は `GroundTruthMidi.md`。
