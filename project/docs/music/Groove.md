# Groove

伴奏グルーヴの概念仕様。実装詳細の設計は `../design/GrooveEngineDesign.md`。

---

## 1. 原則

1. **原曲をコピーしない** — MIDI フレーズの直置き禁止  
2. 抽出してよいのは抽象特徴のみ: スタイル / Humanize / Swing / Accent / Voicing 傾向  
3. 特徴は Knowledge Base + `GrooveProfile` データとして蓄積  
4. 再生エンジンはプロファイルを解釈するだけにする（将来）

---

## 2. パート

| Part | 現状 | 目標 |
|---|---|---|
| Piano | native `buildChordStrikes` | データ駆動パターン + profile |
| Bass | ピアノ内低音層 | 独立プロファイル可 |
| Drum | `DrumProvider` switch | hit リスト + profile |

---

## 3. Groove 次元

| 次元 | 文書 |
|---|---|
| Velocity | `Velocity.md` |
| Timing | `Timing.md` |
| Humanize | `Humanize.md` |
| Piano patterns | `PianoPatterns.md` |
| Drum patterns | `DrumPatterns.md` |

追加次元: Swing, Accent, Strum, Pedal, Ghost Note（各文書および設計書）

---

## 4. 解析ワークフロー（目標）

```text
好きな曲（audio/MIDI）
  → 開発ツールで解析（Basic Pitch / pretty-midi / GMD 等）
  → 特徴量へ抽象化（コピー禁止チェック）
  → project/docs/music または profiles/*.json に蓄積
  → Chord Palette 伴奏がプロファイルを選択・混合
```

---

## 5. 現状 GrooveId

`pop8`, `pop16`, `rock8`, `rock16`, `soul16`, `jazzSwing`, `bossaNova`
