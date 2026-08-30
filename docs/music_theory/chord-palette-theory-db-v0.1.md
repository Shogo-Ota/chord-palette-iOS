# Chord Palette Theory Database v0.1

## 目的

添付理論書の内容を、Chord Palette が参照できる **決定的・コード相対の理論データ** に変換した初版です。

この版では、理論書の内容と Chord Palette 独自の実装判断を混同しないため、出典を3種類に分離しています。

- `BOOK_EXPLICIT`: 本文で明示されている内容
- `BOOK_DIAGRAM`: 表・譜例・図から構造化した内容
- `APP_POLICY_PROPOSED`: Chord Palette 側の設計判断。理論書そのものの主張ではない

## 今回データ化した範囲

### Core Harmony
- 3和音 / 4和音 / 6th / sus4 / add9 / dim7
- メジャー・ダイアトニック
- ナチュラル・マイナー
- コード・スケール
- メジャー / マイナーの基本テンション
- アボイド・ノート
- ドミナント7thのテンション候補

### Functional Harmony
- Tonic / Subdominant / Dominant
- 代理コード
- セカンダリー・ドミナント
- 代理ドミナント
- リレイテッドIIm7
- 同主調からの借用（メジャー&マイナー・ミックス）

### Bass / Chord Symbol
- コードトーンをベースにした分数コード
- コードトーン外をベースにした分数コード

### Voicing
- 7thコードでは3度・7度を性格音として扱う
- 完全5度は原則省略可能
- b5/#5など変化した5度は省略しない
- BassがRootを担当する場合は上声Root省略可
- 3度+7度を骨格にAvailable Tensionを加える

### Progression Vocabulary
- Turnaround
- Line Cliché
- Blues
- Passing Diminished

## 重要: 理論書とアプリ設計を分離した

理論書は「短2度は常に禁止」のような単純なHard Gateを提示していません。

そのため、以下は `APP_POLICY_PROPOSED` として別レイヤにしています。

- 実音程1 semitoneのclose collisionを通常伴奏で回避
- 実音程13 semitonesのminor ninth collisionを通常伴奏で回避
- Low Interval Limit
- コード記号にないextensionを勝手に追加しない

これにより、

`BOOK THEORY -> CHORD PALETTE POLICY -> GENERATOR / VALIDATOR`

の順で実装できます。

## 推奨配置

既存アーキテクチャを考えると、直接 `PerformanceEngine.ts` に書き込まず、

```text
src/lib/musicTheory/
  types.ts
  chordFormulas.ts
  scales.ts
  diatonic.ts
  tensions.ts
  functions.ts
  dominants.ts
  slashChords.ts
  diminished.ts
  voicingRules.ts
  theoryDb.ts

src/lib/performance/harmony/
  HarmonyValidator.ts
  VoicingPlanner.ts
```

のように分けるのが安全です。

## 推奨処理順

```text
Chord Symbol
    ↓
Chord Definition
    ↓
Key / Function
    ↓
Chord Scale
    ↓
Core Chord Tones
    ↓
Available Tensions / Avoid Notes
    ↓
Slash Bass
    ↓
Voicing Planner
    ↓
Harmony Validator
    ↓
Voice Leading
    ↓
MIDI
```

## 今回あえてHard Gateにしていないもの

### アボイド・ノート
本では重要概念ですが、コード・スケールやドミナントの種類で例外・文脈差があります。
したがって、単純な「半音上なら全部reject」は採用していません。

### Tritone
G7の3rd-7thなど、機能和声上必要です。禁止しません。

### Major 7th
Maj7コードの構成要素なので禁止しません。

### Root omission
BassがRootを支える場合に限り、上声では積極的に許可できます。

## v0.1で未確定 / 次フェーズ

1. Harmonic Minor / Melodic Minor の全モードを個別DB化
2. Dominant scale selectionの優先順位
3. Blues専用Chord Scale
4. Turnaround候補の定量ランキング
5. Line ClichéをVoice-leading ruleへ変換
6. Part 4実例から「候補生成ルール」と「単なる例」を分離
7. Instrument別Low Interval Limit
8. Piano / Guitar / Pad別Voicing Profile

これらは理論書の情報だけでなく、Chord Paletteの実際の伴奏聴取・MIDI測定と組み合わせて `DESIGN_TARGET` 化するのが適切です。
