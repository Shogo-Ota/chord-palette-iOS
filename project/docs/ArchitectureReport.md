# Chord Palette Architecture Report

**Phase:** 1 — 現状解析  
**日付:** 2026-07-25  
**対象:** 音楽理論エンジン・伴奏エンジン・開発基盤  
**方針:** 本レポートは読み取り専用の現状解析であり、実装変更は含まない。

---

## 1. Executive Summary

Chord Palette の音楽計算は **外部音楽ライブラリを使わない自前実装** である。理論・候補生成の中心は `src/data/music.ts`、MIDI/ボイシングは `src/lib/voicing.ts`、移調は `src/lib/transpose.ts`。伴奏リズム・Humanize・ドラムは **TypeScript ではなく Swift native**（`modules/chord-audio/ios/`）に集約されている。

長期拡張（テンション拡充・Groove 抽象化・曲解析ワークフロー）に対する最大のボトルネックは次の3点である。

1. **コード定義の分散ハードコード** — 表示名・品質 suffix・音程・degree 候補が複数テーブルに分かれ、単一の Chord AST がない  
2. **伴奏ロジックの native 直書き** — データ駆動ではなく、TS からテスト・差し替えできない  
3. **仕様の正がコード内コメントに散在** — 音楽 Knowledge Base が未整備（Phase 3 で解消予定）

---

## 2. レイヤ構成と依存関係

### 2.1 実際の配置

| 層 | パス | 役割 |
|---|---|---|
| UI | `src/app/`, `src/components/` | 画面・入力。editor は `music.ts` を直接呼ぶ |
| Feature | `src/features/editor/` | session / playback 状態 |
| Data | `src/data/music.ts`, `presets.ts`, `labels.ts` | コード定義・候補生成・UIラベル |
| Domain (lib) | `src/lib/voicing.ts`, `transpose.ts`, … | MIDI・移調・プリセット適用 |
| Types | `src/types/index.ts` | `ChordEvent` / `LibraryChord` / Groove ID 等 |
| Services | `src/services/audio/`, `videoExport/` | JS↔native 橋渡し、スケジュール純関数 |
| Native | `modules/chord-audio/ios/` | 伴奏展開・ドラム・再生・書き出し |
| Repositories | `src/repositories/` | SQLite 永続化 |

`src/domain/` は **存在しない**。`src/lib/README.md` は将来 `lib/music/` を想定しているが、実態は `src/data/music.ts`。

### 2.2 依存グラフ（概要）

```text
UI (app/editor|groove|export)
  ├─ data/music          … ライブラリ候補を直接生成
  ├─ features/editor/session
  │    └─ lib/transpose, lib/presets, lib/progression
  │         └─ data/music (noteAt, keyTonicPc)
  └─ features/editor/playback
       └─ lib/voicing → ChordSpec / MIDI[]
            └─ services/audio → ChordAudioModule (Swift)
                 ├─ AudioEngineController.buildChordStrikes  … Piano伴奏
                 └─ DrumProvider                            … ドラム
```

### 2.3 層境界の問題

| 問題 | 詳細 |
|---|---|
| `lib` → `services` 依存 | `voicing.ts` が `ChordSpec`（`services/audio/schedule`）を import。README の「lib は他層に依存しない」と矛盾 |
| UI → data 直接呼び出し | `editor.tsx` が `availableVariations` / `CHORD_VARIATIONS` を直接使用 |
| 伴奏が domain 外 | Velocity/Timing/Humanize/Swing が Swift private 関数に閉じ、TS テスト不可 |
| 死コード | `COLOR_CHORDS` は未使用（variation 系に置き換わり済み） |

---

## 3. コード定義（Chord Definitions）

### 3.1 所在

- **本体:** `src/data/music.ts`
- **型:** `src/types/index.ts`（`DiatonicChord`, `LibraryChord`, `ChordEvent`, `PresetChord`）
- **プリセット:** `src/data/presets.ts`（度数ベース）

### 3.2 モデル

永続・計算の中核は次の2フィールドである。

| フィールド | 意味 |
|---|---|
| `rootOffset: number` | トニックからの半音（0–11）。Roman ではなく **pitch-class 相対** |
| `suffix: string` | 品質文字列（`''`, `m`, `maj7`, `m9`, `maj13` …）。**型制約なし** |

表示は派生:

- `displayName` = `noteAt(key, rootOffset) + suffix`（slash 時は `/bass`）
- `degreeLabel` = Roman 文字列（`I`, `V7/ii`, `I sus4` 等）
- `subLabel` = カード下部ピル（7th差分 / 解決先 / bass / variation label）

**未存在フィールド:** `symbol`, `buttonLabel`, `quality`, `intervals`, `extensions`, `alterations`, `priority`, `tags`

### 3.3 キー対応

- 12メジャーキーのみ（`MAJOR_KEYS` / `MAJOR_SCALES`）
- シャープキーは `#`、フラットキーは `♭` でスペリング
- マイナーキーは未対応

### 3.4 ライブラリカテゴリ

| カテゴリ | 生成関数 | 備考 |
|---|---|---|
| diatonic (triad) | `diatonicLibrary` | Free。subLabel に7th |
| diatonic (7th) | `diatonicSeventhLibrary` | Free。セブンスは **別トグル/タブ** |
| variation | `variationChord` + `availableVariations` | テンション候補。一部 Free / 一部 Pro |
| secondaryDominant | `secondaryDominants` | Pro。`V7/ii`…`V7/vi` |
| modalInterchange | `modalInterchange` | Pro。平行短調からの借用 |
| slash | `slashChord` | Pro。chromatic bass |

### 3.5 拡張しづらさ

- 品質・表示・音程が **3箇所以上に分散**（`music.ts` suffix / `INTERVALS` / variation map）
- `suffix: string` の typo は実行時に major triad へフォールバック（黙って壊れる）
- Chord symbol AST（root / quality / extensions / alterations / bass）がない

---

## 4. テンション生成

### 4.1 所在

- `CHORD_VARIATIONS` / `DEGREE_VARIATION_SUFFIX` / `availableVariations` / `variationChord`（`src/data/music.ts`）
- UI: `src/app/editor.tsx`（度数チップ → バリエーションピル）

### 4.2 現状の VariationId

`sus4`, `add9`, `6`, `sus2`, `9`, `11`, `13`  
（ボタン label は `6th` など。実 suffix は degree により `maj9` / `m9` 等へマップ）

### 4.3 Degree 別候補（実装）

| Degree | 提供 VariationId | 実 suffix 例（C） |
|---|---|---|
| I | sus4, add9, 6, sus2, 9, 13 | Csus4, Cadd9, C6, Csus2, **Cmaj9**, **Cmaj13**（11なし） |
| ii | 全種 | Dm(add9), Dm6, Dm9, Dm11, Dm13… |
| iii | sus4, 11 | Esus4, Em(add11) |
| IV | sus2, add9, 6, 9, 13 | Fadd9, F6, Fmaj9, Fmaj13（sus4/11なし） |
| V | sus4, sus2, add9, 6, 9, 13 | G9, G13（11なし） |
| vi | sus4, add9, sus2, 9, 11 | Am9, Am11（6/13なし） |
| vii° | （なし） | — |

### 4.4 セブンスとの関係

- ダイアトニック7thは **別トグル**（triad library ↔ seventh library）
- Variation は「7th にテンションを足す」モデルではなく、**単独の quality suffix** になる
- Phase 5 要件「セブンスは別タブ」と現状方針は整合

### 4.5 現状のポリシー vs Phase 5 要求

| 観点 | 現状 | Phase 5 要求 |
|---|---|---|
| Avoid note | **考慮する**（degree 別除外） | **考慮しない** |
| 実用性 / ポップス優先 | ダイアトニック安全寄りの狭いセット | 広げる（maj11, 6/9, alt 等） |
| ジャズ対応 | V の altered / ♭9 等なし | V に ♭9/♯9/alt 等を追加 |
| vii° | バリエーションなし | m7♭5(9) 等を追加 |

→ Phase 5 は **ポリシー転換**（avoid-note 駆動 → 実用カタログ駆動）になる。UI 骨格は維持可能だが、`DEGREE_VARIATION_SUFFIX` / `CHORD_VARIATIONS` / `INTERVALS` の全面見直しが必要。

---

## 5. コード表示

### 5.1 表示フィールド

| フィールド | 用途 |
|---|---|
| `displayName` | カード中央の大きいコード名 |
| `degreeLabel` | 小さい Roman / 機能ラベル |
| `subLabel` | 下部ピル |
| `CHORD_VARIATIONS[].label` | バリエーションボタン文言 |

`buttonLabel` / `symbol` は **型にも実装にも存在しない**。

### 5.2 表記の揺れ・ギャップ

- 要件例の `Imaj7` / `IIm7` と実装の `I` / `ii` が不一致（品質が degree に載らないことが多い）
- `#` と `♭` が混在（キー署名依存）。Unicode 正規化レイヤなし
- `displayName` と音響 `suffix` が同一結合に依存しており、国際化・別表記に弱い

---

## 6. MIDI 生成

### 6.1 所在

- `chordMidiNotes` / `progressionToChordSpecs` — `src/lib/voicing.ts`
- 再生橋渡し — `src/features/editor/playback.ts`
- 書き出し — `src/lib/exportPlan.ts`
- Native は MIDI 配列のみ受け取り、理論計算はしない

### 6.2 アルゴリズム

```text
rootMidi = 48 + pc(tonic + rootOffset)     // C3 帯
body     = rootMidi + INTERVALS[suffix]
bass     = [24 + bassPc, 36 + bassPc]      // C1 + C2（slash 時は bassOffset）
return [...bass, ...body]
```

- 未知 suffix → major triad フォールバック
- 拡張コードは **コンパクト配置**（例: `'13' = [0,4,7,10,14,21]`）。完全堆積ではない
- `'11'` は3度省略 `[0,5,7,10,14]`

### 6.3 問題点

- オクターブ固定。転回形・レンジ制御なし
- 表示名 / intervals / MIDI の一致を保証する単一スキーマがない（Phase 5/7 の核心課題）

---

## 7. ボイシング

### 7.1 現状

- **クローズド・ルートポジションのみ**（固定レジスタ）
- Slash は低音オクターブ差し替えのみ（ボディは root position のまま）
- **未実装:** inversion / drop2 / drop3 / voice leading / 省略音ルールのアルゴリズム化

### 7.2 要件ギャップ

- 要件 §5.5「基本的なボイスリーディングを自動適用」→ **未達**
- 進行間の共通音保持・最短移動がないため、遷移が機械的

---

## 8. ディグリー（Roman Numerals）

### 8.1 現状

- 表示定数: `DEGREE_LABELS = ['I','ii','iii','IV','V','vi','vii°']`
- 機能: I/iii/vi=tonic, ii/IV=subdominant, V/vii°=dominant
- 計算実体は `rootOffset`（半音）。Roman パーサは **ない**
- 二次ドミナント `V7/ii`、借用 `♭VII`、variation `I sus4` は文字列連結

### 8.2 問題点

- `degreeIndex`（0–6）と `rootOffset`（0–11）が混在。借用和音は index を持たない
- 品質付き度数（`Imaj7`）と品質なし（`I`）を統一するスキーマがない

---

## 9. 移調（Transposition）

### 9.1 所在

- `src/lib/transpose.ts`
- session: `setKey` / `transposeTo`（`src/features/editor/session.ts`）

### 9.2 2系統の操作（実装済み・良い点）

| 操作 | 関数 | 意味 |
|---|---|---|
| 移調 | `transposeProgression` | 度数維持で音名・表示を再計算（曲を動かす） |
| キー変更 | `rebaseProgression` | 絶対ピッチ維持で `rootOffset` をシフト（参照キーだけ変更） |

### 9.3 問題点

- `rootOffset` 欠落の legacy イベントは転調されない（マイグレーション未実装）
- `degreeLabel` は基本そのまま（slash の bass のみ再拼写）

---

## 10. ピアノ伴奏

### 10.1 所在

- **生成本体:** `modules/chord-audio/ios/AudioEngineController.swift`（`buildChordStrikes`）
- **パターン ID:** `AccompanimentPattern = 'block' | 'eightBeat' | 'sixteenthBeat' | 'arpeggio'`
- **MIDI 入力:** `chordMidiNotes`（JS）→ Native がリズム展開

### 10.2 パターン挙動（要約）

| パターン | 挙動 |
|---|---|
| block | コード開始で全ノート同時。微 strum(~12ms)。timing sway なし |
| eightBeat | bass(`midi<48`): 4分 / body: 8分 + upbeat 食い + strum |
| sixteenthBeat | bass: 4分 / body: 16分（ghost・食いあり） |
| arpeggio | bass sustain / body: 16分アルペジオ順 |

### 10.3 Velocity / Timing / Strum / Pedal

| 要素 | 実装 | 制御面 |
|---|---|---|
| Velocity | パターン vel × humanize × イベント vel | UI から実質未活用（default 100） |
| Timing | `timingSway`（決定論的） | ハードコード |
| Strum | ノート昇順の微小ロール | ハードコード |
| Pedal | CC64 なし。`ringCap`（次コード変化で切音）の疑似ペダル | ハードコード |

### 10.4 問題点

- 伴奏ロジックが巨大 private Swift に直書き（データ駆動でない）
- JS から humanize/strum/pedal を触れない
- Jest から伴奏差分を回帰テストできない

---

## 11. ドラム

### 11.1 所在

- `modules/chord-audio/ios/DrumProvider.swift`（`SynthDrumProvider`）
- `GrooveId`: pop8 / pop16 / rock8 / rock16 / soul16 / jazzSwing / bossaNova

### 11.2 現状

- 1小節(4拍)固定パターン。合成ワンショット（サンプル音源ではない）
- Voice: kick / snare / hatClosed / hatOpen / ride / rim
- Ghost: soul16 スネアに明示あり
- Accent: HH downbeat 強調、キック/スネア固定 vel
- Swing: **jazzSwing のみ** ride を `beat + 2/3`（三連）。一般 swing 量パラメータなし

### 11.3 問題点

- `switch` 直書き。フィル/バリエーションなし
- ドラム側 humanize なし
- ピアノ伴奏と swing グリッドが一致しない
- グルーヴ別初期 BPM（要件）は未実装

---

## 12. Bass

- **独立 Bass トラック/音色はない**
- `voicing.ts` が C1+C2 を付与し、native が `midi < 48` を bass 層として別グリッド再生
- しきい値 48 がハードコード（ボイシング変更と密結合）
- ウォーキングベース等は構造上載せにくい

---

## 13. Humanize

### 13.1 実装

```swift
humanize(_ base: Float, seed: Double, amount: Float = 0.07) -> Float
timingSway(seed: Double, amountBeats: Double) -> Double
```

- 決定論的 sin-hash
- 適用: piano 伴奏の gain / 一部タイミング
- ドラム側なし
- **UI / PlaybackRequest / プロジェクト設定にパラメータなし**

### 13.2 拡張しづらさ

- 量・シード戦略が埋め込みで A/B 困難
- 「曲解析 → 抽象特徴の蓄積」ワークフロー（Phase 6）の受け皿が無い

---

## 14. データ構造（現状スキーマ）

### 14.1 中核型（要約）

```ts
LibraryChord / ChordEvent {
  id, displayName, degreeLabel, function,
  rootOffset, suffix, bassOffset?, bassNote?,
  variation?, category?, isPro?, subLabel?
}
```

### 14.2 Phase 7 要求とのギャップ

| Phase 7 要求フィールド | 現状 |
|---|---|
| symbol | なし |
| displayName | あり |
| buttonLabel | なし |
| quality | なし（`suffix` 文字列で代用） |
| intervals | なし（`INTERVALS` 別表） |
| extensions | なし |
| alterations | なし |
| degree | `degreeLabel` 文字列のみ |
| category | あり（別意味: ライブラリタブ） |
| priority | なし |
| tags | なし（Preset にのみ tags） |

全12キー自動変換は **`rootOffset` + `noteAt` で部分的に成立**しているが、定義本体はキーごとに生成する関数群であり、「キー非依存の定義レコード → 全キー展開」にはなっていない。

---

## 15. 依存関係（外部ライブラリ）

| 領域 | 使用ライブラリ |
|---|---|
| 音楽理論 | **なし**（自前） |
| MIDI / シーケンス | **なし**（自前 + Swift） |
| 音源 | FluidR3 GM SoundFont（SF2）、AVAudioEngine |
| アプリ基盤 | Expo / React Native / Jest / expo-sqlite |

`tonal` / `@tonaljs` / `Tone.js` / `music21` / `pretty-midi` 等は **未導入**。  
→ Phase 2（OSS 比較）で採用/参考/不採用を判断する。

---

## 16. テスト現状

| 領域 | テスト |  sufficiency |
|---|---|---|
| ダイアトニック / variation | `src/data/__tests__/music.test.ts` | 基本あり。全 suffix×12キー網羅ではない |
| MIDI / voicing | `src/lib/__tests__/voicing.test.ts` | 基本あり |
| 移調 / rebase | `src/lib/__tests__/transpose.test.ts` | 基本あり |
| スケジュール数学 | `src/services/audio/__tests__/schedule.test.ts` | あり（伴奏展開は含まない） |
| Piano伴奏 / Drum / Humanize | **なし**（Swift 側ユニットテストなし） | 最大リスク |
| UI | 自動E2Eは Evaluator/Playwright 想定。伴奏理論の契約テストは未整備 | |

---

## 17. 伴奏パイプライン（End-to-End）

```text
EditorSession
  { progression, key, tempo, grooveId, accompanimentPattern, instrumentId }
        │
        ▼
chordMidiNotes / progressionToChordSpecs   (TS: ブロック MIDI)
        │
        ▼
buildProgression → NoteEvent[]             (TS: 拍境界)
        │
        ▼
sessionToPlaybackRequest                   (TS)
        │
        ▼
ChordAudioModule.play                      (Swift bridge)
        │
        ├─ buildChordStrikes  … pattern × humanize × strum × look × ringCap
        └─ DrumProvider       … groove hits
              │
              └─ AVAudioEngine sample clock（再生 / export 同一経路）
```

要点: **JS はコード境界のブロック MIDI まで。リズム伴奏は native が opaque に展開。**  
Export は再生と同一 `buildChordStrikes` を使うため、再生と書き出しの一致は保ちやすい（良い点）。

---

## 18. 仕様ギャップ一覧（要件 / Sprint / 実装）

| 項目 | 状態 |
|---|---|
| 11th/13th | 要件では対象外記載あり / Sprint・実装では Pro として採用済み（文書矛盾） |
| degree 表記 | 要件例 `Imaj7` vs 実装 `I` |
| ボイスリーディング | 要件あり / **未実装** |
| グルーヴ別初期 BPM | 要件あり / **未実装** |
| Groove UI 音量スライダー | **見た目のみ**（`audioService` 未接続） |
| Avoid-note テンション方針 | 現状あり / Phase 5 で撤廃予定 → Knowledge Base で明文化必須 |
| Sprint1 申し送り「variation 一律提示」 | **すでに degree 別出し分け済み**（ドキュメント陳腐化） |

---

## 19. 拡張に向けた構造的結論

### 19.1 強み（残すべきもの）

1. `rootOffset` + `suffix` による度数ベース永続化（移調に強い）
2. キー変更（rebase）と移調（transpose）の分離
3. Native が MIDI 配列だけ受け取る契約（理論計算を JS に置ける）
4. 再生と Export の伴奏経路一致
5. セブンス別トグル（Phase 5 前提と整合）

### 19.2 弱み（Phase 2–8 で設計すべきもの）

1. **単一の音楽仕様書がない** → Phase 3 Knowledge Base  
2. **Chord 定義がハードコード分散** → Phase 7 データ構造  
3. **テンションが avoid-note 固定マップ** → Phase 5 カタログ再設計  
4. **伴奏が Swift 直書き** → Phase 6 Groove Engine（特徴抽象 + Knowledge 蓄積）  
5. **伴奏・ドラムの自動テスト欠如** → Phase 8  
6. **Cursor 開発時の専門 Reviewer 不在** → Phase 4  

### 19.3 推奨アーキテクチャ方針（提案・未承認）

> 実装禁止フェーズのため、方針案のみ。承認後に詳細設計へ進む。

```text
project/docs/music/*          … 唯一の音楽仕様（人間・エージェント共通の正）
        │
src/lib/music/                … 純関数ドメイン（定義解決・移調・MIDI・将来の groove 特徴）
        │                       ※ UI / native 非依存、単体テスト可能
        ├─ definitions/       … キー非依存 ChordDefinition レコード
        ├─ voicing/           … intervals → MIDI / 将来 voice-lead
        └─ groove/            … Velocity/Timing/Humanize プロファイル（データ）
                │
                ▼
services/audio + native       … プロファイルを消費する再生器（ロジックを持たない方向へ）
```

OSS は「全面置換」より **参考実装 / 部分採用** を基本方針候補とする（Phase 2 で比較）。

---

## 20. Phase 1 完了レポート

### 変更内容

- 本ファイル `project/docs/ArchitectureReport.md` を新設（解析結果の文書化のみ）
- **アプリケーションコードの変更なし**

### 影響範囲

- ドキュメントのみ。ランタイム・UI・音声・ビルドへの影響なし

### 次フェーズ（Phase 2）

- 対象 OSS: Tonal / Magenta / Groove MIDI Dataset / Basic Pitch / Impro-Visor / pretty-midi / miditok / music21
- 成果物: `OSSComparison.md`（採用 / 参考実装 / 不採用の提案付き）
- 着手条件: **本レポート承認後**

### Phase 2 着手前に確認したい点（推測で進めないため）

1. Knowledge Base のパスは指定どおり `project/docs/music/` でよいか（既存 `docs/` との役割分担）  
   - **推奨:** `project/docs/` = 本アップデートの設計・音楽仕様、`docs/` = 既存スプリント/デザイントークンのまま
2. OSS は「アプリ実行時依存」と「オフライン解析ツール（開発用）」を分けて評価してよいか  
   - **推奨:** 分ける（RN/iOS バンドル肥大を避ける）
3. Phase 5 の「アボイドノートは考慮しない」は、ダイアトニック安全性より実用カタログを優先する正式方針か  
   - **推奨:** 正式方針とし、Knowledge Base に明記。UI は維持、候補セットのみ拡張

---

## Appendix A — 主要ファイル索引

| 関心事 | ファイル |
|---|---|
| コード定義・テンション | `src/data/music.ts` |
| MIDI / ボイシング | `src/lib/voicing.ts` |
| 移調 | `src/lib/transpose.ts` |
| 型 | `src/types/index.ts` |
| 再生橋渡し | `src/features/editor/playback.ts` |
| スケジュール純関数 | `src/services/audio/schedule.ts` |
| Piano伴奏 / Humanize | `modules/chord-audio/ios/AudioEngineController.swift` |
| ドラム | `modules/chord-audio/ios/DrumProvider.swift` |
| Groove UI | `src/app/groove.tsx` |
| 理論テスト | `src/data/__tests__/music.test.ts` |
| Voicing/移調テスト | `src/lib/__tests__/voicing.test.ts`, `transpose.test.ts` |

## Appendix B — 現状 INTERVALS キー一覧

`''`, `m`, `dim`, `aug`, `maj7`, `m7`, `7`, `m7♭5`, `dim7`, `sus2`, `sus4`, `6`, `m6`, `add9`, `9`, `11`, `13`, `maj9`, `maj13`, `m(add9)`, `m(add11)`, `m9`, `m11`, `m13`
