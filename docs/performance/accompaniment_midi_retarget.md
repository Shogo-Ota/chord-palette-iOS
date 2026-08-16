# 伴奏 MIDI 転用パイプライン（新方式）

- 制定: 2026-08-13
- 関連: [`docs/midi_dataset_policy.md`](../midi_dataset_policy.md)、`src/lib/performance/library/`

## 方針

市販曲の構成・Energy・Bass×Kick 関係を学習してノブへ寄せない。  
**伴奏用にあらかじめ用意した MIDI** からリズム／ボイシング成分だけを相対抽出し、コードパレット上のユーザー進行へ転用する。

```
伴奏MIDI + 手動コード注釈
  → LibraryPattern（相対）
  → realize（ユーザー進行）
  → NoteEvent[]
```

- 生 MIDI はアプリに同梱しない（既存ポリシー維持）。登録は相対形式のみ。
- Style は **Ballad 先行**。Band / City への即展開はしない。
- Energy UI（Aメロ/Bメロ/サビっぽく）は維持。骨格の主経路は MIDI 転用。

## 抽出してよいもの（ホワイトリスト）

### 必須

| 項目 | 表現 |
|---|---|
| BPM / Meter | `bpmRange`, `timeSignature` |
| 小節長 | `patternLengthBeats` / annotation `bars` |
| 発音位置 | `RelativeNote.posBeats` |
| Duration / Gate | `RelativeNote.durationBeats` |
| Velocity | `RelativeNote.velocityRatio`（+ accentMap） |
| Rest | 当該拍に onset が無いこと（明示 rest 型は必須にしない） |
| 同時発音数 | 同一 `posBeats` の notes 数 |
| Voicing | `chordToneIndex` + `octaveOffset` |
| Arpeggio 順序 | 同一 onset 内の notes 配列順 |
| Chord-relative role | `chordToneIndex`（root=0, 3rd=1, …） |

### かなり重要

| 項目 | 表現 |
|---|---|
| Voice Leading / Common tone / Top movement | `progressionHints` + realize 時の既存 VL |
| Bass の動き | `progressionHints.bassMotion`（または bass 役割パターン） |
| 4 小節目だけの Variation | `phraseVariation`（`barInPhrase === 3`） |

## 抽出してはいけないもの（ブラックリスト）

- 曲構成推定
- Aメロ / Bメロ / サビ推定
- 原曲の Bass / Drums 関係解析
- 曲全体の Energy 解析
- Emotion 推定
- Genre 推定
- 市販曲 Aggregate → Energy DESIGN_TARGET 寄せ

## 教師 MIDI の条件

1. **伴奏用**に用意されたパターン（特定曲のコピー採譜は不可）
2. 権利は [`docs/midi_dataset_policy.md`](../midi_dataset_policy.md) に従う（自作／許諾済み優先）
3. コード枠は **手動注釈**（自動コード推定しない）
4. 非コードトーンは relativize で除外されるため、伴奏 MIDI はコードトーン中心で作る

## 製品接続

- `realizeLibraryPattern` → `NoteEvent[]`（domain、RN 非依存）
- `generatePerformance(..., { libraryPatternId })` は **Ballad のみ**有効
- 未指定時は従来の手書き骨格パス（後方互換）

## ローカル保存構成（git 外）

リポジトリ直下。`.gitignore` の `LocalDatasets/` / `LocalAnalysis/` により **コミットしない**。

```text
LocalDatasets/
├── Manuals/
│   └── piano_midi_manual.pdf
├── AccompanimentMidi/
│   └── PianoMidiCollection/
│       ├── P1_C1.mid
│       ├── P1_C2.mid
│       └── …
├── ReferenceAudio/
│   └── PianoMidiCollection/          # 付属 WAV（任意）
├── Instruments/
│   ├── GrandPiano/
│   │   └── SalamanderGrandPiano.sf2
│   └── ElectricPiano/
│       └── RhodesElectricPiano.sf2
└── CommercialSongMidi/               # 市販曲分析用（旧経路・製品根拠にしない）

LocalAnalysis/
└── accompaniment_patterns/           # 伴奏MIDIからの相対抽出結果
```

| パス | 用途 |
|---|---|
| `AccompanimentMidi/` | **新方式の正** — 伴奏用 MIDI |
| `Manuals/` | コレクション説明 PDF |
| `ReferenceAudio/` | 付属 WAV（任意） |
| `Instruments/` | ローカル試聴用 SF2（アプリ同梱とは別） |
| `LocalAnalysis/accompaniment_patterns/` | ingest / 相対パターン出力 |

市販曲 MIDI は `CommercialSongMidi/` に残してよいが、Energy / 構成学習の教師には使わない。
