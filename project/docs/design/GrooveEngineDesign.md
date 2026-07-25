# Groove Engine 設計（Phase 6）

対象: Piano / Bass / Drum  
解析次元: Velocity, Timing, Humanize, Swing, Accent, Strum, Pedal, Ghost Note

---

## 1. ゴール

「好きな曲を解析し、特徴を抽象化して Chord Palette へ反映」できること。  
**原曲フレーズのコピーは禁止。** 知識だけを KB / profile に蓄積する。

---

## 2. 現状課題（ArchitectureReport より）

- 伴奏ロジックが `AudioEngineController.buildChordStrikes` に直書き
- Bass 独立なし（midi&lt;48）
- Humanize/Swing がハードコード
- 自動テスト不能

---

## 3. 提案アーキテクチャ

```text
[Dev toolchain]
  audio/MIDI → Basic Pitch / pretty-midi / GMD
       → FeatureExtractor
       → GrooveFeatures (abstract)
       → profiles/*.json + docs/music notes

[Runtime]
  GrooveProfile + PatternDoc + Chord MIDI
       → GrooveEngine.compile()  … 理想は TS pure
       → NoteStrike[] / DrumHit[]
       → Native renderer（再生のみ）
```

### 3.1 データ型（論理）

```ts
type GrooveFeatures = {
  swingRatio: number;          // 0.5 straight … ~0.67 triplet
  timingBiasBeats: number;     // push/pull
  velocityAccent: number[];    // per 16th or beat
  ghostDensity: number;
  strumMs: number;
  pedalStyle: 'none' | 'ringCap' | 'cc64';
  humanize: { velocityAmount: number; timingAmountBeats: number };
  voicingHints?: { density: 'close' | 'open'; topNoteBias?: number };
};

type GrooveProfile = {
  id: string;
  tags: string[];              // pop, soul, jazz…
  source: { type: 'gmd' | 'user-analysis' | 'handcrafted'; attribution?: string };
  features: GrooveFeatures;
  pianoPatternId: string;
  drumPatternId: string;
  bassPatternId?: string;
};
```

### 3.2 コピー禁止ガード

FeatureExtractor の出力スキーマに **生ノート列を含めない**。  
許可: 統計量・ヒストグラム・比率・スタイルタグ。  
PR チェック: `groove-reviewer` が製品コードへの MIDI フレーズ埋め込みを拒否。

---

## 4. パート別

| Part | 設計 |
|---|---|
| Piano | PatternDoc（stroke 列）× features（swing/strum/humanize/pedal） |
| Bass | 独立 PatternDoc（root/5th/approach）。当面は既存二重バス互換モード |
| Drum | Hit 列 × ghost/accent features。GMD 由来特徴で初期プロファイル生成可 |

---

## 5. 移行ステップ（実装は承認後）

1. **文書化**（本 Phase）— パターンを JSON に起こす（挙動変更なし）  
2. **TS に compile を移す** — native は strikes 再生のみ  
3. **Profile 選択 UI** — 既存 GrooveId を profile にマッピング  
4. **解析ツール** — `tools/groove-analyze`（pretty-midi + 任意 Basic Pitch）  
5. **KB 蓄積** — 特徴を `Humanize.md` 等へ事例として追記  

---

## 6. OSS の使い方（Phase 2 結論）

| OSS | 役割 |
|---|---|
| GMD | ドラム特徴の教師データ（CC BY） |
| pretty-midi | MIDI 解析 |
| Magenta | (hit,vel,offset) 概念の参考 |
| Basic Pitch | 曲→MIDI 入口（開発） |

---

## 7. 代替案

| 案 | 内容 | 評価 |
|---|---|---|
| A | Swift のままパラメータだけ公開 | 速いがテスト困難 |
| B | TS GrooveEngine + native render **推奨** | テスト可能・KB 連携しやすい |
| C | オンデバイス ML humanize | 重い・時期尚早 |

---

## 8. 影響範囲（実装時）

- 新規: `src/lib/groove/**`, profiles, tools
- 改修: chord-audio bridge 契約、groove UI
- KB: Groove*.md 更新必須
