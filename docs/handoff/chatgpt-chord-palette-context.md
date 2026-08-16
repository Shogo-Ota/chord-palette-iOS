# Chord Palette — ChatGPT 壁打ち用コンテキストパック

- 作成: 2026-08-12
- 用途: 別ウィンドウの ChatGPT に、伴奏品質・MIDI 分析・Style×Energy 開発の前提を渡す
- この1本で会話を開始できる。深掘り時だけ下の「添付ファイル」を追加する

**このパックに含めないもの:** 市販 MIDI 本体、生イベント列、LocalAnalysis の巨大 JSON、秘密情報。

---

## 0. ChatGPT への渡し方（推奨）

1. 本ファイルをそのまま貼る（最優先）
2. 余力があれば Tier 1 を添付
3. 「今の作業」を1段落で足す（例: Ballad の DESIGN_TARGET を提案してほしい）

ChatGPT への指示例:

```text
あなたは Chord Palette の開発壁打ち相手です。
添付のコンテキストを正としてください。
仕様にない機能を提案しない。Engine / Energy Profile は承認なしに変更しない。
不明点は最大5問、各問に推奨案を付ける。
HYPOTHESIS と MEASURED を混同しない。
```

---

## 1. 必要なスキル（壁打ち相手に求めるもの）

| 領域 | 内容 | 不要なもの |
|---|---|---|
| プロダクト | コード進行アプリ。DAW でも Suno でもない。ユーザーがコードを選び、アプリが伴奏を鳴らす | 全自動作曲 |
| 音楽 | ボイシング、ボイスリーディング、コード機能（root/3rd/7th…）、Groove（格子・ゲート・レスト）、編曲（Piano/Bass/Drums の役割） | 原曲コピー、メロディ生成 |
| データ | MIDI を **測定** し、相対特徴に変換し、複数曲で集約し、Design Target にする | 学習用コーパス構築が目的化すること |
| 実装思想 | 決定的・編集可能・任意進行・リアルタイムプレビュー。ルールエンジンが本体 | ブラックボックス MIDI 生成 |
| 法務 | 市販 MIDI は内部分析のみ。製品に原曲イベントを入れない | 無断 MIDI 収集 |
| モバイル | Expo / React Native / 層分離。解析は git 外 LocalAnalysis | iOS に PyTorch を入れる |

音楽の「エモさ」は単一スコアにしない。harmony / VL / tension / register / gate / sustain / dynamics / density / silence / bass / drums / section transition の複合結果として扱う。

---

## 2. プロダクト（最短）

**Chord Palette** は、ダイアトニック起点でコードを並べ、Style 伴奏を鳴らし、縦動画にも出せる iOS 作曲スケッチアプリ。

中核価値:

1. コードを直感的に選べる
2. すぐ音楽として鳴る
3. 伴奏が自然で、もう一度聴きたくなる ← **いまの重点**

ユーザー操作は増やさない。Aメロ/サビの自動判定をユーザーに課さない。盛り上がりは **Energy**（内部: verse / build / chorus、UI: Aメロっぽく / Bメロっぽく / サビっぽく）。デフォルトは `build`。

仕様の正: `Chord_Palette_iOS_MVP_Requirements_v1.md` と `docs/`。矛盾したら勝手に決めず、矛盾点・選択肢・推奨を出す。

---

## 3. アーキテクチャ

```
src/app/          画面（薄く。表示と入力のみ）
src/features/     画面固有ロジック
src/lib/          ドメイン（UI非依存・単体テスト）
src/repositories/ SQLite / Convex
src/services/     外部SaaS
src/modules/      Native（chord-audio / chord-video-export）
```

- 課金・認証・Native を画面に直書きしない
- ドメインは React Native / Expo に依存しない
- 新機能は既存安定コードの改変よりファイル追加を優先
- 承認前に大量ファイルを一括変更しない
- `@ts-ignore` 禁止
- Phase 2 以前に Expo Go を壊すネイティブ依存を足さない

伴奏エンジンの中心:

- `src/lib/performance/PerformanceEngine.ts`
- `src/lib/performance/energy/`（Style × Energy）
- `src/lib/performance/model/styleCards.ts`
- `src/lib/performance/styles/`（ballad, eightBeat, sixteenBeat…）
- `src/lib/performance/voiceLeading.ts` / voicing

---

## 4. データパイプライン（壊してはいけない）

```
Commercial MIDI（git外・製品非同梱）
  → Measured Song Features
  → Style Aggregate（2曲以上。1曲なら MEASURED_SONG のまま）
  → Design Target
  → Chord Palette Engine
```

将来（Encoder は補助。Explicit 分析は残す）:

```
Normalized Symbolic Representation
  ├─ Explicit Feature Analysis
  └─ Optional Music Encoder → Style/Groove Embedding
       → Style Aggregate → Design Target → Engine
```

### 証拠ラベル（必須）

| ラベル | 意味 |
|---|---|
| `MEASURED` / `MEASURED_SONG` | 特定 MIDI の実測 |
| `MEASURED_AGGREGATE` | 複数曲集約 |
| `USER_LISTENING` | 人間の聴取 |
| `DESIGN_TARGET` | アプリ用設計値 |
| `HYPOTHESIS` | 未検証 |
| `UNKNOWN` | 判断不能 |

Reference Songs プレイリスト（`docs/style_datasets/*_teacher.md`）は **Measured ではない**。曲名から演奏を断定しない。

### 製品に入れてよい / いけない

入れてよい: 集約統計、相対特徴、独自ルール、Energy Profile  
いけない: 原曲 MIDI、メロディ、固有リフ、イベント列、曲名指定の「あの曲風」

市販 MIDI は量子化が強い。**Humanize の ms をここから学習しない。**

---

## 5. Style × Energy（実装済み・変更は承認後）

内部 Energy: `verse` | `build` | `chorus`（デフォルト `build`）

Energy はリズム骨格を差し替えない。「同じ Style をどう演奏するか」のノブ。

主なノブ: noteDensity, attackDensity, velocityDelta, registerOffset, voicingWidthDelta, gateScale, restRatioScale, syncopationScale, phraseVariationScale, bassActivityScale, drumActivityScale, topNoteEmphasisScale, phraseEnd

コード: `src/lib/performance/energy/types.ts`, `profiles.ts`, `applyEnergy.ts`

**承認なしに Energy Profile / Engine を変えない。** 分析結果は DESIGN_TARGET 提案まで。

---

## 6. 市販 MIDI パイロット（Ballad 3曲）— 2026-08 時点

git 外: `LocalDatasets/CommercialSongMidi/Ballad/`  
分析: `LocalAnalysis/`（gitignore）

| 曲 | 役割 | Piano | Bass/Drums | 人間ラベルで使える遷移 |
|---|---|---|---|---|
| 三日月 / 絢香 | Arrangement / Energy 教師 | **ch1**（ch0=メロディ除外） | あり | BUILD(Cメロ)→CHORUS(ラスサビ)。VERSE 欠測 |
| 奏 / スキマスイッチ | Piano Groove / Voicing 教師 | ch0 のみ | なし | VERSE(Aメロ)→CHORUS。SECTION_D 混在は除外。BUILD 欠ける |
| 愛をこめて花束を / Superfly | Dynamic / Chorus / 総グルーヴ | ch1 | ch2 bass / ch9 drums | VERSE→BUILD→CHORUS |

セクションは **人間ラベル優先**。密度から VERSE/BUILD/CHORUS を逆推定しない。混在ブロックは除外してよい。

MIDI bars = ファイル tick 0 からの小節。最初の可聴ノートではない。

### Step A（4 Profile 分解）の要点

Harmony / Groove / Arrangement / Performance を混ぜて1指標にしない。

- 奏: pedal 高い、broken≈0.55。サビへ attacks↑ gate↓ vel↑
- 三日月 BUILD→CHORUS: register ほぼ不変、vel↓、ドラム密度↓（Cメロが厚い）
- 花束を BUILD→CHORUS: bass/drum↑、piano vel↓。Chorus lift は速度固定ではない

初期の攻撃クラスタ解析はアルペジオを和音と誤認（notes/voicing≈1.8、VL≈9）。拍窓に直して改善。

### Normalized Event Schema

奏 Prototype → 判定 **B**（Harmony/Groove 有効、全曲の生イベント保存はしない）  
花束を Multi-Part → 判定 **A**（パート関係も Schema で測れる）

必須軸: Bar, Position, Part, Duration, Velocity, Register, Chord-relative role, Section  
追加: subdivision（16分強制しない。triplet/other 可）, drumRole, bassRole  
microtiming 対象外。emotion スカラー禁止。

花束をで分かったこと（MEASURED_SONG、1曲）:

1. 盛り上がりで Piano 自身はあまり変わらない（CHORUS で密度↑・vel↓・voicingほぼ不変）
2. Bass/Drums の寄与が大きい（BUILD はドラム痩せ、CHORUS でドラム激増・Bass 根音比率↑）
3. Bass×Kick は常時 exact 同期ではない（exact≈0.5）
4. Piano は Kick に寄り、Hat とは complementary が多い。「ドラム全体と同時」は密度で飽和するので使わない
5. 関係自体が Section で変わる
6. 関係は exact / near / complementary に分解して測る

AI モデル（MusicBERT / MuseCoco / REMI / MusicVAE）: **Level 1 表現のみ採用。Generator 不採用。Encoder は将来。GPL の REMI 実装は製品に入れない。**

---

## 7. 優先順位（品質改善）

1. Harmony（VL / voicing / tension、コード相対）
2. Groove（格子・gate・rest・broken。ms ではない）
3. Energy（Arrangement 差分。`chorus.registerOffset=+3` や chorus velocity 固定は不支持）
4. Humanize（後回し。量子化 MIDI から学習しない）

内部レイヤ: `Style → Energy → Musical Profiles (Harmony/Groove/Arrangement/Performance) → Generator`

---

## 8. 作業ルール（エージェント）

変更前に出す: 今から行うこと / 対象ファイル / 技術的理由 / 期待結果 / 完了見込み（項目ごと）

変更後に出す: 実施内容 / ファイル / コマンド / テスト / 未解決 / 次

不明点は最大5問、各問に推奨案。

フェーズは順番。着手前に対象/対象外/ファイル/リスク/確認方法/完了条件を出して承認待ち。

開発パイプライン（ある場合）: Planner → Generator → Designer → Evaluator。Evaluator 不合格なら該当エージェントへ戻す。

---

## 9. いまやってはいけないこと

- Engine / Energy Profile / UI の無断変更
- 3曲一括の生イベント JSON 恒久保存
- 全9曲展開
- MusicBERT / MuseCoco / PyTorch を本番や iOS へ
- 学習・fine-tuning・MIDI 生成モデル
- 原曲イベントを `assets` へ
- エモさスコアの自動推定
- Reference Songs を Measured として扱う
- 三日月 ch0 をピアノ伴奏として使う

---

## 10. 次に議論してよいこと（例）

- Ballad DESIGN_TARGET の草案（実装は承認後）
- 関係窓を eighth 格子でも出す、など測定パラメータ
- 花束を以外へ Summary のみ展開するか
- 奏 SECTION_D の分割ラベルが来たら VERSE/BUILD を復活

---

## 11. ChatGPT に添付するファイル

### Tier 1（本ファイルに加えて、可能なら）

| ファイル | 理由 |
|---|---|
| `docs/product_vision_v1.01.md` | 製品思想 |
| `docs/midi_dataset_policy.md` | MIDI 合法性 |
| `docs/song_analysis/song_midi_analysis_policy.md` | 市販 MIDI 分析の禁止/層 |
| `docs/song_analysis/style_aggregation_policy.md` | 集約ルール |
| `src/lib/performance/energy/types.ts` | Energy の契約 |
| `docs/style_datasets/ballad_teacher.md` | Ballad 参照曲（未測定リスト） |

### Tier 2（Engine / 仕様を触るとき）

| ファイル | 理由 |
|---|---|
| `Chord_Palette_iOS_MVP_Requirements_v1.md` | MVP 要件 |
| `docs/engine_specs/ballad_engine_spec.md` | Ballad 仕様（一部「未着手」と書いてあるが Energy は実装済み。文書が古い箇所あり） |
| `docs/implementation_v1.01.md` | 実装原則 |
| `src/lib/performance/energy/profiles.ts` | 現行 DESIGN_TARGET 数値 |
| `src/lib/performance/energy/applyEnergy.ts` | 適用方法 |
| `.cursor/rules/architecture.mdc` | 層分離 |
| `.cursor/rules/workflow.mdc` | 作業ルール |
| `docs/song_analysis/app_reflection_compliance.md` | アプリ反映時の遵守 |

### Tier 3（必要になったら）

- `docs/style_datasets/listening_analysis_guide.md`
- `docs/song_analysis/song_analysis_workflow.md`
- `project/docs/music/Voicing.md` / `Groove.md` / `Humanize.md`
- `docs/engine_specs/band_engine_spec.md` 等（Ballad 以外）
- LocalAnalysis の **Summary だけ**（イベント JSON は渡さない）
  - `LocalAnalysis/reports/ballad/ballad_section_user_labels.md`
  - `LocalAnalysis/reports/ballad/kanade_normalized_prototype.md`
  - `LocalAnalysis/normalized/hanataba_section_delta.json`
  - `LocalAnalysis/normalized/hanataba_part_relationships.json`

### 渡さない

- `LocalDatasets/**/*.mid`
- `LocalAnalysis/normalized/*_normalized_events.json`（奏の生イベント）
- `.env` / 証明書 / EAS ログの秘密

---

## 12. コードを読むときの入口

```
src/lib/performance/PerformanceEngine.ts
src/lib/performance/energy/
src/lib/performance/styles/ballad.ts
src/lib/performance/bass/planBassLine.ts
src/lib/performance/voiceLeading.ts
src/features/editor/playback.ts
src/app/groove.tsx
```

解析スクリプト（git 外・本番非依存）:

```
LocalAnalysis/scripts/ballad_stepA_four_profiles.py
LocalAnalysis/scripts/kanade_normalized_events.py
LocalAnalysis/scripts/hanataba_multipart_validation.py
```
