# Groove

伴奏グルーヴの概念仕様。実装の正本は `src/lib/performance/`（Feel → StylePreset + VariationProfile）。  
**Music Theory Engine（何を鳴らすか）とは分離する。** 本ディレクトリの Groove 系文書は「いつ・どれくらいの強さで鳴らすか」の正である。

---

## 1. 原則

1. **原曲をコピーしない** — MIDI フレーズの直置き禁止  
2. 抽出してよいのは抽象特徴のみ: スタイル / Humanize / Swing / Accent / Voicing 傾向  
3. 特徴は Knowledge Base + `GrooveProfile` データとして蓄積  
4. 再生エンジンはプロファイルを解釈するだけにする  
5. **最終教師は「オーナーが気持ちいいと感じる MIDI」** — OSS・論文は土台。方向性は正解データが決める  

---

## 2. 投資優先順位（製品全体）

| 順 | 領域 | 役割 |
|---|---|---|
| 1 | Music Theory Engine | コード・テンション・度数・移調 |
| 2 | Groove Engine | Humanize・リズム・マイクロタイミング |
| 3 | Voicing Engine | 声部配置・開離・トップノート |
| 4 | AI Melody Engine | メロディ生成（理論KB＋GrooveFeatures を入力） |

「このコードいいな」という印象のかなりの部分は演奏のノリに依存する。  
そのため理論を正したあと、**正解 MIDI 由来の Groove 特徴**で聴感を引き上げる。

---

## 3. 目標アーキテクチャ

```text
Chord Palette
├── Music Theory Engine      … project/docs/music/Theory〜Transposition
├── Groove Engine            … 本文書以下 + src/lib/performance
├── Voicing Engine           …（次投資）
├── Accompaniment Engine     … Groove compile の上位（Piano/Bass 統合）
├── MIDI Engine              … 入出力・開発用解析
├── AI Melody Engine         … 最後
├── Music Theory Reviewer
└── Groove Reviewer
```

境界:

```text
[Theory] ChordDefinition → MIDI notes（何を）
[Groove] Pattern + Features → BeatStrike / DrumHit（いつ・強さ）
[Renderer] Native 発音のみ
```

---

## 4. パート

| Part | 現状 | 目標 |
|---|---|---|
| Piano | TS `compilePiano` + Native フォールバック | PatternDoc + profile |
| Bass | ピアノ内低音 / `bassPatterns` | 独立プロファイル |
| Drum | TS hits + Native 合成 | hit リスト + profile |

---

## 5. Groove 次元（文書）

| 次元 | 文書 |
|---|---|
| Velocity | `Velocity.md` |
| Timing | `Timing.md` |
| Humanize | `Humanize.md` |
| Swing | `Swing.md` |
| Accent | `Accent.md` |
| Piano patterns | `PianoPatterns.md` |
| Drum patterns | `DrumPatterns.md` |

数値レンジは「絶対の正解」ではなく **スタイルごとの基準**。正解 MIDI 解析で更新する。

---

## 6. 正解 MIDI ワークフロー（最重要）

```text
オーナーが選んだ MIDI（例: 好きな打ち込み・J-POP/シティポップ）
  → 解析チェックリスト（§6.1）
  → 抽象特徴のみ抽出（フレーズ直置き禁止）
  → GroundTruthMidi.md 台帳へ記録
  → Velocity / Timing / Humanize / Swing / Accent / Piano / Drum を更新
  → GrooveProfile（または pattern 定数）へ反映
  → groove-reviewer が差分レビュー
```

### 6.1 解析チェックリスト（1曲ごと）

| # | 抽出項目 | 書き先の例 |
|---|---|---|
| 1 | Velocity（拍・声部・ghost） | `Velocity.md`, `Accent.md` |
| 2 | 発音タイミング（ms / beats、前ノリ/後ろ） | `Timing.md`, `Swing.md` |
| 3 | ノート長 / ring | `PianoPatterns.md`, `Humanize.md` |
| 4 | コードの分散方法 | `PianoPatterns.md` |
| 5 | 低音の置き方 | `PianoPatterns.md`, bass profile |
| 6 | ストラム感 | `PianoPatterns.md`（strumMs） |
| 7 | シンコペーション | pattern strokes / drum hits |
| 8 | 休符（意図的スペース） | pattern densitiy / ghost |

OSS（Groove MIDI Dataset, pretty-midi, Magenta 概念, Basic Pitch 等）は **抽出手法・比較の土台**として使う。最終的な好みの方向は正解データが優先する。

詳細台帳: `GroundTruthMidi.md`

---

## 7. 現状 GrooveId

`pop8`, `pop16`, `rock8`, `rock16`, `soul16`, `jazzSwing`, `bossaNova`

---

## 8. 変更ルール

1. Groove の数値・パターンを変える PR は、先に本ディレクトリ（該当 md）を更新する  
2. `groove-reviewer` が差分をレビューする  
3. Preview と Export の決定論を壊さない  
4. 製品コードに生 MIDI ノート列を埋め込まない  
