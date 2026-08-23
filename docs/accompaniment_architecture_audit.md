# 伴奏アーキテクチャ監査 — PHASE A / PHASE B

§1〜§6 は PHASE A（監査時点の実装をコード変更なしで追跡）。§7 以降が PHASE B（Hard Gate 化と最初の PDCA `gate-01`）の結果。

- 測定コマンド: `npm run quality:audit` / `npm run quality:gate01`
- 測定成果物: `LocalAnalysis/accompaniment_quality/audit_phase_a/`、`.../experiments/gate-01/`
- 測定対象: Golden Progressions A–F（directive §30 準拠、`src/lib/midiQa/goldenProgressions.ts`）
- 共有品質台帳: `docs/current_quality_status.md`
- 詳細実験台帳（local）: `LocalAnalysis/accompaniment_quality/current_status.json`

> PHASE A の記述は監査時点のスナップショットとして残す。`sustain` の音長 ×2 は §7 の `gate-01` で廃止済みであり、現在の実装ではない。

---

## 1. Production 到達可能グラフ

公開UI（伴奏設定）から到達できる経路のみを記す。`PUBLIC_ACCOMPANIMENT_PATTERNS = ['block', 'natural', 'city']`（`src/lib/performance/publicAccompaniment.ts`）。

```
EditorSession (src/features/editor/session.ts)
  │  instrumentEffect は normalizePublicInstrumentEffect() で常に 'sustain' に固定される
  ▼
buildSessionPerformancePlan  (src/lib/performance/finalMidi/buildSessionPerformancePlan.ts)
  │
  ├─ progressionToPerfChords (src/lib/performance/progressionInput.ts)
  │    └─ progressionToChordSpecs (src/lib/voicing.ts)
  │         └─ voiceLeadProgression + voicingAestheticFor(pattern, tier)
  │         → PerfChord.bassMidi / bodyMidi / arpMidi   ← 【VOICING SoT ①】
  │         → PerfChord.harmony (chordHarmonyFromEvent)  ← 【HARMONY SoT】
  │
  ├─ remeterChords → chords
  │
  ├─ generatePerformance (src/lib/performance/PerformanceEngine.ts)
  │    │
  │    ├─ [city]    realizeIndependentStyle → realizePublicCityType1
  │    │              └─ buildStableFullVoicings(chords)   ← 【VOICING SoT ②】harmony のみ使用
  │    │              └─ applyVoicingMask (chordComping/masks.ts)
  │    │            ※ 即 return。bass track / variation / ensureChordAudible 以外の層を通らない
  │    │
  │    ├─ [natural] humanTemplateId あり
  │    │              └─ realizeHumanTemplate → realizeVoiceStructureAttack
  │    │                   (humanTemplate/voiceStructureRealize.ts) ← 【VOICING SoT ③】
  │    │                 ・attack 単位で毎回ゼロから pitch を決定（Base Voicing を持たない）
  │    │                 ・legacy bass track は tracksFor(..., omitLegacyBass=true) で除外
  │    │
  │    └─ [block]   humanTemplate なし → styles/ 経路
  │                   collectStrikes → chord.bodyMidi をそのまま発音
  │                   bass track: planBassLine(profile=ROOT_ONLY) = identity
  │
  ├─ applyHarmonyGate  … 違反を検出するだけ。pitch を書き換えない（snapped は常に 0）
  │
  └─ applyInstrumentEffect(notes, 'sustain')
       └─ applyReleaseCut(events, false)  ← 全 piano note の durationBeat を ×2.0（上限 2.5 beat）
  ▼
SessionPerformancePlan.notes = Final MIDI
  │
  ├─ buildFinalMidiSnapshot
  │    └─ controlChanges: instrumentEffect !== 'releaseCut' なら pedalCcFromHumanTemplate() を書く
  │       → 'sustain' のとき「音長 ×2」と「CC64」が同時に載る
  │
  ├─ playbackEngine (default 'sequencer') → NoteOn/NoteOff/CC64 → AVAudioUnitSampler
  ├─ services/midiExport → writeSmf
  └─ services/videoExport → 同じ plan を再利用
```

### 到達不能（Production から呼ばれない）

| パス | 状態 | 根拠 |
|---|---|---|
| `src/lib/performance/library/` | DEAD | `libraryPatternId` を渡す production caller が存在しない（`PerformanceEngine.ts` 以外は test のみ） |
| `src/lib/performance/naturalAtomic/` | EXPERIMENTAL | 参照元は `scripts/audition/naturalAtomicPoc.harness.ts` と自身の test のみ |
| `src/lib/accompanimentQuality/` | EXPERIMENTAL | `src/` 内の他モジュールから import されていない（POP909 / preference 実験コード） |
| `src/lib/performance/analysis/` | ANALYSIS_ONLY | ballad baseline / playback fidelity レポート生成用 |
| `humanTemplatePitchMode: 'teacherFidelity'` | TEST_ONLY | production は常に既定の `'userChord'` |
| `playbackEngine 'sampled'` | DIAGNOSTIC | 既定は `'sequencer'`。dev画面の override のみ |

### 禁止 import（directive §32）

`src/` から `LocalAnalysis` / `LocalDatasets` / blind listening harness / POP909 raw analyzer への import は **0件**。ただし POP909 / preference 実験コードは `src/lib/accompanimentQuality/` として **production ツリーの中に同居**している（到達はしないが隔離もされていない）。§42 の観点で要整理。

---

## 2. Source of Truth 監査

| 責務 | Production SoT | 重複/競合 | 判定 |
|---|---|---|---|
| Harmony（許容 pitch class） | `chordHarmonyFromEvent` → `resolveAllowed`（strictV2） | なし | **OK / 単一** |
| Harmony 検証 | `harmonyGate/harmonyGate.ts` | なし | OK / 単一 |
| Base Voicing | **3系統が並立** | ①`src/lib/voicing.ts` ②`chordComping/fullVoicing.ts` ③`humanTemplate/voiceStructureRealize.ts` | **CONFLICT** |
| Register 方針 | ①`VOICING_AESTHETICS`(floor/ceil/center) ②`voicingCost`(soft 36–60 / 48–84) ③`PREFERRED_LO/HI = 36/79` + `strictV2/registerPolicy` | 3系統が別の数値を持つ | **CONFLICT** |
| Bass 生成 | Block: `chord.bassMidi`、City: Full Voicing の LEFT note、Natural: attack ごとの bass slot | `bass/planBassLine.ts` は public 経路では identity か未使用 | 実質 3系統 |
| Sustain / pedal | ①`releaseCut.ts` の音長 ×2.0 ②`pedalCcFromTemplate.ts` の CC64 | **同時に適用される** | **CONFLICT** → §7 で解消（①を削除） |
| Playback | `services/audio/playbackEngine.ts`（sequencer 既定） | `sampled` は diagnostic のみ | OK |

---

## 3. 計測されたエビデンス

### 3.1 HARMONY — PASS

Golden A–F × public 3 style × effect 2種 = 36ケースで **illegal pitch class = 0**（`harmony_legality.json`）。

- `applyHarmonyGate` は snap しない設計（`snapped` は常に 0）
- Natural の `isLegal()`、City の mask、Block の `bodyMidi` すべて許容 PC 内
- §1 / §2 / §28 の harmony 条項は現状 **満たしている**

### 3.2 STYLE PITCH INVARIANCE — FAIL

`style_pitch_invariance_summary.json`：

| 指標 | 値 |
|---|---|
| 比較コード数 | 24 |
| pitch 完全一致 | **0 / 24** |
| pitch class は一致（pitch は不一致） | 19 / 24 |
| bass pitch 一致 | 7 / 24 |
| top pitch 一致 | 3 / 24 |
| bass の style 間ばらつき最大 | **12 半音** |
| top の style 間ばらつき最大 | **12 半音** |

同一 progression / 同一 register 設定 / 同一 override で style だけを変えると、同じコードが最大 1 オクターブ違う位置で鳴る。§4「STYLE MUST NOT CHANGE PITCH」および §8 に対する明確な違反。

原因は Style が pitch を後から動かしているのではなく、**Style ごとに別の Voicing Engine が最初から別の Base を作っている**こと（§2 の CONFLICT）。

### 3.3 BASE VOICING ENGINE の乖離 — FAIL

`base_voicing_engines_summary.json`：`progressionToChordSpecs`（Block/Variation が読む）と `buildStableFullVoicings`（City が読む）を同じ入力で比較。

| 指標 | 値 |
|---|---|
| 比較コード数 | 24 |
| 完全一致 | **0 / 24** |
| bass 差の最大 | 12 半音 |
| top 差の最大 | 12 半音 |

加えて `buildStableFullVoicings` は `chord.harmony` のみを読むため、**`octaveShift`（音域プリファレンス）が City に一切効かない**。§26 の「音域」パラメータは City では無効。

### 3.4 GATE / REST / PEDAL — FAIL（最大ボトルネック）

Production の公開セッションは `normalizePublicInstrumentEffect()` が引数を無視して常に `'sustain'` を返すため、**必ず** `applyReleaseCut(events, false)` を通る（`RING_FACTOR = 2.0`、上限 2.5 beat）。

一方、これまでの自動QA・PoC・listening は **すべて `instrumentEffect: 'off'`** で行われていた（`src/lib/midiQa/generate.ts:46`、`src/lib/playback/phase3cCases.ts:61`、`src/lib/playback/fixtures.ts:72`、City 統合テスト）。つまり**評価した音と出荷する音が違う**。

`gate_rest_effect_impact.json`（Golden A、他progressionも同一値）：

| style | 平均 gate (off) | 平均 gate (sustain) | 倍率 | rest率 off→sustain | 発音占有率 off→sustain | 次attackへの被り off→sustain | CC64 |
|---|---|---|---|---|---|---|---|
| block | 3.903 | 3.903 | ×1.00 | 1.00 → 1.00 | 0.976 → 0.976 | 0 → 0 | 0 |
| natural | 0.487 | 0.954 | ×1.96 | 0.58 → 0.52 | 0.708 → **1.000** | 13 → 15 | **16** |
| city | 0.227 | 0.454 | ×2.00 | **1.00 → 0.65** | 0.341 → 0.579 | **0 → 8** | 0 |

読み取り:

1. **Natural は production で発音占有率 1.000** = 進行中に休符が一切存在しない。§16「SILENCE / GAP IS FIRST-CLASS」が完全に失われている。
2. **Natural は二重サスティン**。音長 ×2 と teacher の CC64（16イベント）が同時に載る。`buildFinalMidiSnapshot` 自身のコメントが「sustain effect は既に音長に入っているので pedal を足すと二重になる」と書いているのに、実装は `releaseCut` のときだけ pedal を空にしている。
3. **City は identity を半分失っている**。forensic 由来の「全 attack 間に休符がある（rest率 1.00）」「late-bar silence」が rest率 0.65 に落ち、0 だった次 attack への被りが 8 箇所発生。listening で選ばれた Candidate B の音とは別物になっている。
4. Block は長い音符に上限 2.5 beat が効くため実質 no-op。

これは §20「synthetic duration stretch to fake pedal 禁止」の直接違反であり、§36 が最優先と定める Gate / Gap / Rest / Accent の全域を壊している。

### 3.5 TEACHER PITCH 構造の残存 — 設計違反（harmony は合法）

`humanTemplate/voiceStructureRealize.ts` は Natural の pitch を teacher の pitch 構造から導いている。

- `placeOnTeacherRegister()` … teacher の絶対音高を配置ターゲットにする
- `placeOnSpacing()` … teacher の音間隔を再現する
- `scoreCandidate()` … `teacherSpan` / `teacherCenter` / `Math.abs(lowest - teacher0)` / 各声部 `0.45 * |p - teacherPitch|` をコストに加算

pitch class は `isLegal()` で許容集合に閉じているため **harmony leakage は無い**が、register / inversion / spacing は teacher が決めている。§13「Teacher の Note ごとの Pitch 構造を User Chord へ再マッピングする方式を Natural の中心設計にしない」に反する。

同時に、Natural には **Base Voicing という概念が存在しない**（attack ごとに独立に解く）。§3 の canonical pipeline に「Base Voicing Progression」段が無いため、§4 / §29 を構造的に満たせない。

`strictV2/voicingOptimizer.ts` の `nearestSeed()` は §43 が禁じる "nearest legal pitch snapping" そのものだが、Natural production 経路は `realizeVoiceStructureAttack` を通るため **現状は到達しない**（`optimizeAttack` の production caller なし）。

### 3.6 PASSING NOTE / LEGACY BASS — public 経路では到達不能

`bass/planBassLine.ts` の `connectivePitch()` は passing tone / chromatic approach を生成する（§2 禁止）。到達性:

| pattern | humanTemplate | bass track | bass profile | passing note |
|---|---|---|---|---|
| block | なし | あり | `ROOT_ONLY`（identity） | 到達しない |
| natural | あり | `omitLegacyBass` で除外 | — | 到達しない |
| city | — | 早期 return | — | 到達しない |
| driving（非公開・保存済み session のみ） | なし | あり | `DRIVE_LINE` (approach 0.6, passing true) | **到達する** |
| beat16 / beat8 / shuffle 等（非公開） | なし | あり | POP/BAND/CITY_LINE | **到達する** |

公開3パターンは安全。ただし保存済みプロジェクトが非公開 rhythm を持つ場合は §2 違反が鳴る。

### 3.7 その他の Style 依存 pitch 変更

| 箇所 | 内容 | 公開経路での到達 |
|---|---|---|
| `voicingAestheticFor(pattern, tier)` | `relaxed`→warmLow / `driving`→brightOpen で floor・ceil・center が変わる | 公開3種は `balanced` のため無効 |
| `voicingAestheticFor(_, 'pro')` | tier が pro だと全 pattern が `proOpen`（ceil 79 / center 62） | **到達する**。tier で pitch が変わるのは §4 の趣旨に反する |
| `PerformanceEngine.ts` L664–673 | Energy の `registerOffsetSemitones` で chord/top を移調 | Block は `holdAllChordTones` で除外、Natural/City は chord strikes が空のため無効 |
| `src/lib/midiQa/generate.ts:57` | QA は tier `'pro'` で描画 | QA と free ユーザーの voicing が別物 |

### 3.8 Golden Progressions のカバレッジ

既存 `src/lib/midiQa/progressions.ts` は §30 の Golden Set と一致していない。

| §30 | 既存 midiQa | 状態 |
|---|---|---|
| A `C\|Am\|F\|G` | A | 一致 |
| B `D\|Bm\|G\|A` | B | 一致 |
| C `Cmaj7\|Am7\|Fmaj7\|G7` | D | id 相違 |
| D `C\|G/B\|Am\|F` | なし | **欠落（slash bass 未カバー）** |
| E `C\|Cadd9\|Cmaj7\|C7` | E（Am7/Fadd9 版） | 相違 |
| F `Gm9\|C7(♭9)\|Am7\|Dm7` | F（同一根音の quality 列） | **欠落** |

本監査では `scripts/quality/goldenProgressions.ts` に §30 準拠の A–F を新設し、以後の実験はこちらを正とする。

---

## 4. 分類

### PRODUCTION（Source of Truth）

| パス | 責務 | SoT |
|---|---|---|
| `finalMidi/buildSessionPerformancePlan.ts` | session → Final MIDI の単一入口 | yes |
| `progressionInput.ts` + `src/lib/voicing.ts` | Base Voicing ①（Block/Variation） | 競合あり |
| `chordComping/fullVoicing.ts` + `masks.ts` | Base Voicing ②（City）+ mask 語彙 | 競合あり |
| `humanTemplate/voiceStructureRealize.ts` | Natural の attack 単位 pitch ③ | 競合あり |
| `humanTemplate/chordHarmony.ts` + `strictV2/harmonyResolver.ts` | Harmony | yes |
| `harmonyGate/harmonyGate.ts` | Harmony 検証 | yes |
| `city/publicCityType1.ts` + `independentStyles.ts` | City Type1 公開経路 | yes |
| `styles/` + `variation/` + `feel/` | Block と非公開 rhythm の skeleton | yes（Block のみ） |
| `effect/` | 音長シェイピング（`releaseCut` のみ。`sustain` は identity） | yes（§7 で是正） |
| `finalMidi/pedalCcFromTemplate.ts` | CC64 | yes |
| `services/audio/playbackEngine.ts` | 再生（sequencer 既定） | yes |

### EXPERIMENTAL（production 到達なし・production ツリー内に同居）

`src/lib/performance/naturalAtomic/`、`src/lib/accompanimentQuality/`（POP909 / preference）、`scripts/pop909/`、`scripts/preference/`、`scripts/groovePreference/`、`scripts/audition/naturalAtomicPoc.harness.ts`

### ANALYSIS_ONLY

`src/lib/performance/analysis/`、`src/lib/midiQa/`、`scripts/midiQa/`、`scripts/city/`、`scripts/quality/`、`LocalAnalysis/`、`LocalDatasets/`

### DEPRECATED（削除候補）

| パス | 代替 |
|---|---|
| `src/lib/performance/library/` | Human MIDI Template |
| `strictV2/voicingOptimizer.ts` の `optimizeAttack` / `nearestSeed` | `voiceStructureRealize` → 将来は Shared Compact Voicing |
| `humanTemplatePitchMode: 'teacherFidelity'` | 低レベル regression 専用として維持 |
| `playbackEngine 'sampled'` | `sequencer` |

---

## 5. 品質ボトルネックの順位

| # | カテゴリ | 内容 | 影響 | 可逆性 |
|---|---|---|---|---|
| 1 | **GATE / REST / PEDAL** | 公開経路が強制する `sustain` が全音長を ×2 し、Natural は休符ゼロ + 二重サスティン、City は identity の半分を喪失 | 全公開 style の聴感を直接支配。§16 / §20 違反 | 高（1ファイルの方針変更） |
| 2 | VOICING / REGISTER | Base Voicing が 3 系統。style pitch 一致 0/24、bass ばらつき最大 12 半音 | §4 / §8 / §29 違反 | 中（Shared Compact Voicing への段階移行） |
| 3 | VOICING（Natural 構造） | Natural に Base Voicing 段が無く teacher pitch 構造依存 | §13 違反。#2 の前提条件 | 中 |
| 4 | REGISTER（UI 整合） | `octaveShift` が City に効かない / tier で voicing が変わる | §26 / §4 | 高 |
| 5 | HARMONY | 違反 0 | — | — |

**#1 を最初の PDCA 対象とする。** 単一カテゴリ（GATE）で、可逆、かつ #2 以降の実験結果を汚染しないため（今のまま #2 を測ると、音長 ×2 で潰れた音を比較することになる）。

---

## 6. 次アクション（PHASE A 時点）

1. Baseline artifact 保存（Golden A–F × 公開3種の Final MIDI + metrics）
2. 実験 `gate-01`: `sustain` の音長 ×2 を廃止し、ring は CC64 のみに委ねる案を A/B
3. Hard Gate 化: harmony contract / style pitch invariance / gate-rest regression を自動テストへ
4. #2 VOICING へ移行（Shared Compact Voicing Engine の PoC）

---

## 7. PHASE B — 実験 `gate-01`（GATE）: KEEP

`LocalAnalysis/accompaniment_quality/experiments/gate-01/`

### 仮説

公開経路が強制する `sustain` は「音長 ×2.0」と「CC64」を同時に載せている。ring を CC64 だけに任せれば、§16 の休符と §14 の City identity が Final MIDI に戻るはずである。pitch / onset / velocity / note 数は一切変わらないため、変化するのは GATE 1カテゴリのみ。

### 実測（Golden A–F、公開3 style）

| style | rest率 A→B | 発音占有率 A→B | 次attackへの被り A→B | 二重サスティン箇所 A→B |
|---|---|---|---|---|
| block | 1.00 → 1.00 | 0.965 → 0.965 | 0 → 0 | 0 → 0 |
| natural | 0.516 → 0.581 | **1.000 → 0.708** | 15 → 13 | **6 → 0** |
| city | **0.652 → 1.000** | 0.579 → 0.341 | **8 → 0** | 0 → 0 |

- A = 変更前の production（`sustain` = 音長 ×2 + CC64）
- B = 候補（書かれた音長のまま + CC64）
- pitch / onset / velocity / note 数は両アームで完全一致（= GATE 単一軸の実験として成立）
- illegal pitch class・pitch clamp は両アームで 0

City は listening で選ばれた Candidate B の identity（全 stab の後に実休符）を完全に回復した。Natural は進行中に休符がゼロだった状態から脱した。Block は上限 2.5 beat が効いていたため元から no-op。

### 採用した production 変更

判定 **KEEP**。根拠は聴感の好みではなく契約違反の是正（§20「synthetic duration stretch to fake pedal 禁止」、§16「silence is first-class」）。

| ファイル | 変更 |
|---|---|
| `effect/applyInstrumentEffect.ts` | `'sustain'` を identity 化。ring は CC64 のみ |
| `effect/types.ts` | `'sustain'` の doc を「CC64 で鳴らす / 音長は変えない」に再定義 |
| `finalMidi/buildFinalMidiSnapshot.ts` | 「二重サスティンになる」旨の古いコメントを削除 |
| `performance/releaseCut.ts` | **削除**（唯一の caller が消えたため。§42） |
| `performance/__tests__/releaseCut.test.ts` | **削除** |
| `effect/__tests__/instrumentEffect.test.ts` | 「sustain は音長を伸ばす」→「音長を保つ」に再仕様化 |

UI に見える effect ID（`sustain`）は変更していない。ユーザー体験上は「ペダルで鳴る」という意味が変わらず、実装だけが CC64 単一経路になった。

### Hard Gate の常設化

`src/lib/performance/__tests__/accompanimentQualityContract.test.ts`（42 tests、本番 jest スイート内）。Golden A–F × 公開5スロットで以下を恒久的に固定する。

| 契約 | 対応 directive | 結果 |
|---|---|---|
| User chord 外の pitch class を鳴らさない | §1 | PASS |
| 要求されていない extension を足さない | §2 / §28 | PASS |
| pedal 代わりに音長を伸ばさない | §20 | PASS |
| CC64 と音長で二重に鳴らさない | §20 | PASS |
| City は全 stab 間に休符を持つ | §14 / §16 | PASS |
| 同時刻に同一 MIDI pitch を重複させない | §28 | PASS |
| MIDI 0–127 を出ない | §28 | PASS |
| 明示 slash bass を最低音として守る | §28 | PASS |
| 1 style 内で bass 移動 <12 半音 / top 移動 <15 半音 | §7 | PASS |
| style を変えても同じコードは同じ pitch | §4 / §29 | **`it.failing`（既知未解決）** |

最後の 1 件は blocker `style-pitch-variance` として台帳に残す。24/24 不一致であり、Shared Compact Voicing Engine の導入時に `it.failing` → `it` へ反転させることで完了判定に使う。

### Regression

`regression.json`。`npm test` = **108 suites / 2078 passed / 0 failed**（green）。新規 failure は 0。

なお本セッション開始時点で `npm test` はそもそも素直に通らなかった。

1. jest が展開済みビルド成果物 `dist-check/` を拾っていた（従来は毎回 CLI で `--testPathIgnorePatterns` を渡していた）
2. `LocalAnalysis/` の観測専用ハーネスが本番スイートの合否を握っていた（§32 / §42 違反）
3. 期待値が古いテストが 2件赤だった

`jest.config.js` に `dist-check/` と `LocalAnalysis/` の除外を入れ、後者は `npm run quality:localAnalysis` で意図的に走らせる構成に分離した。古い 2件は以下のとおり是正した（緩めていない）。

| テスト | 古い前提 | 実態 | 是正 |
|---|---|---|---|
| `performanceMapper.test.ts` の既定 variant seed | `natural.auto` が既定 | 既定は `natural.type1`（`variants/__tests__/catalog.test.ts` が既にそう検証している） | 既定リストを `natural.type1` に修正 |
| `run_playback_fidelity.test.ts` | 出荷 engine は `sampled`、playback CC64 は 0 | 出荷は `sequencer`、CC64 は playback まで届く | 「`sequencer` を出荷し CC64 を1つも落とさない（`playbackCc64 === finalCc64`）」と「legacy sampler はペダルを受け取らなかった」に分割 |

2つ目の是正は副産物として **§28「CC64 loss = 0」を実測する gate** になった（Natural / Variation ともに 16/16 到達）。

`npm run midi:qa` の出力は本実験では不変（QA は `'off'` で描画するため）。ただし既存の corpus findings を記録した。

- `register_span` 8件: natural type1/type3 の Golden F（36–74）、arpeggio type1（最大 91）
- transpose findings 223件: **すべて duration / velocity で pitch は 0件**。performance seed が progression を含むため、移調すると humanize が変わる。移調そのものは正しい

いずれも別カテゴリの実験として台帳に登録した。

---

## 8. PHASE C 以降の予定

1. **gate-02（GATE）**: Natural が書かれた音長の時点で 13/31 の遷移で次 attack に被る問題。1軸（gate 長）のみ変更
2. **PHASE C/D（VOICING）**: Shared Compact Voicing Engine。`style-pitch-variance` の解消をもって `it.failing` を反転
3. **衛生**: `src/lib/accompanimentQuality/`（POP909 / preference 実験）と `src/lib/performance/library/`（DEAD）の隔離または削除（§42）。`LocalAnalysis/` の分離は §7 で完了

---

## 9. SEPTEMBER RELEASE QUALITY RECOVERY — PHASE 0

監査日: 2026-08-17

対象: `quality/autonomous-pdca` / `3aeabce`

制約: Production コード変更なし。特に Harmony / Voicing は未変更。

### 9.1 User-observed P0

Fresh launch、`F | G | Em | Am`、Natural Type1、Drum OFF、Loop ON。四カウント後の最初の playback が正しく流れず、Loop OFF にして先頭から再生し直すと正常になる。

現時点では実機 fresh-start の診断ログを未取得であり、root cause は **未確定**。ただし静的到達性監査では、観測と強く一致する cold-start 専用処理を確認した。

### 9.2 First playback の Production 到達可能グラフ

```text
Editor mount
  └─ editor.tsx: prepareAudio()
       └─ audioService.prepare()
            └─ ChordAudioModule.prepare()
                 └─ AudioEngineController.prepare()
                      ├─ AVAudioSession configure / activate
                      ├─ buildEngine()
                      │    ├─ RealtimeSamplerEngine を attach（楽器は未load）
                      │    └─ CountInPlayer を attach
                      ├─ AVAudioEngine.start()
                      ├─ legacy SampledInstrumentProvider に piano を load
                      ├─ legacy drum voice を load
                      └─ CountInPlayer の percussion bank を load

Play tap
  └─ editor.tsx: togglePlayback()
       └─ editorPlaybackRequest(session, loop, tier)
            ├─ buildSessionPerformancePlan()
            ├─ FinalMidiSnapshot → NativeMidiEvent[]
            └─ countIn = 4 beats
       └─ audioService.play()（JS play queue）
            └─ ChordAudioModule.play()
                 └─ AudioEngineController.playAfterCountIn()
                      ├─ state = playing（music開始前）
                      ├─ CountInPlayer.play()
                      └─ countIn completion
                           └─ main queue: pending start closure
                                └─ AudioEngineController.playRealtime()
                                     ├─ SoundFont URL resolve
                                     ├─ RealtimeSamplerEngine.setInstrument()
                                     │    └─ 初回のみ 148MB GM SoundFontを
                                     │       AVAudioUnitSamplerへ同期load
                                     └─ RealtimeSamplerEngine.play()
                                          ├─ loop 0をschedule
                                          ├─ Loop ONならloop 1も先行schedule
                                          └─ position timer開始
```

### 9.3 P0 root-cause candidate

#### Candidate 1 — Realtime sampler の初回 SoundFont load が count-in 後（最有力）

**確認済み事実**

- `prepare()` は realtime sampler を attach するが、realtime用 melodic program を load しない。
- `prepare()` 内の `setInstrument("piano")` は `useRealtimeEngine == false` のため、legacy `SampledInstrumentProvider` を準備する。
- CountIn sampler は prepare 中に percussion bank を load する。
- Realtime sampler の melodic program は、count-in completion後の `playRealtime()` → `rt.setInstrument()` で初めて load される。
- `loadSoundBankInstrument` はその start closure 内で同期実行される。
- `RealtimeSamplerEngine` は `(instrument, program)` を保持し、2回目以降は即 return する。
- bundled GM SoundFont は約148MB。初回だけ発生する処理として十分に大きい。

**観測との整合**

- 四カウントは CountIn専用 sampler なので正常に鳴り得る。
- 四カウント完了後、music scheduling前にcold loadが入る。
- LoopをOFFにしたこと自体ではなく、再生し直してwarm stateになったことで正常化した可能性がある。

**未確認**

- 実機上の `countIn.handoff` → `play.v2` の実時間差。
- その差が「遅延」だけか、Audio Unit / engine状態を不整合にするか。
- Loop ONとOFFでcold stateの結果が本当に異なるか。

#### Candidate 2 — prepare/play の非直列race

**確認済み事実**

- editor mountは `audioService.prepare()` を開始するがawaitせず、listener登録とUI表示へ進む。
- `audioService.play()` のqueueはplay同士だけを直列化し、prepare/stop/teardownとは直列化しない。
- `togglePlayback()` 自体には `ready` guardがない。
- native `playAfterCountIn()` は `prepared == false` なら記録もstate変更もせずreturnする。

ユーザー操作まで通常は十分な時間があるためCandidate 1より優先度は低いが、true fresh state matrixでは必ず観測する。

#### Candidate 3 — Loop先行schedule / first-boundary

Loop ONでは `RealtimeSamplerEngine.play()` がloop 0とloop 1を同時にarmする。コード上、未来のwork itemを登録するだけで現在のnoteを直接変更しないため、現時点で具体的な破綻根拠はない。Loop OFFで直るという観測だけを理由にLoop実装を変更してはならない。

### 9.4 現在取得できる診断情報と不足

既存 `PlaybackDiagnostics` は以下を記録できる。

- `prepare`, `prepare.rearm`
- `countIn.start`, `countIn.complete`, `countIn.handoff`
- `play.v2`, `play.v2.error`, `play.v2.reject`
- stop/pause/resume、route change、interruption、engine configuration change
- realtime plan signature、event数、pitch range、CC64数、engine running

不足:

- realtime instrument load の start/end時刻と所要時間
- Play request受信時の prepared/state/loop/count-in/generation
- count-in handoff時に渡されたplan signature
- MIDI beat 0の最初のNoteOnを実際に送った時刻
- JS側 prepare/play/stop generation の対応番号

PHASE 1ではまずこの観測穴だけを埋める。Harmony/Voicing/Final MIDI生成は変更しない。

### 9.5 Required fresh-state matrix の現状

| Scenario | 自動test | 実機 |
|---|---|---|
| Fresh launch → Loop ON → Play | 未実装 | 未実施 |
| Fresh launch → Loop OFF → Play | 未実装 | 未実施 |
| Stop → Play | 部分的なunitのみ | 未実施 |
| Loop ON → OFF → Play | 未実装 | 未実施 |
| Loop OFF → ON → Play | 未実装 | 未実施 |
| Natural → Block → Natural | generation単体のみ | 未実施 |
| Progression change → Play | plan生成testのみ | 未実施 |
| 10 consecutive fresh starts | 未実装 | 未実施 |

既存 `playbackCountIn.test.ts` は「通常Editor Playだけにcount-inが付く」1条件のみで、transport readinessやnative handoffは検証していない。

### 9.6 Music Sources of Truth（再監査）

以前の結論は現ブランチでも有効。

| 責務 | 現Production | 判定 |
|---|---|---|
| Allowed pitch classes | `theory/definitions/catalog.ts` → `chordHarmonyFromEvent` → `resolveAllowed` | 単一 |
| Harmony検出 | `harmonyGate/harmonyGate.ts`（修復/snapなし） | 単一 |
| Block base pitches | `progressionToChordSpecs()` の `bassMidi/bodyMidi` | Voicing競合① |
| Natural pitches | `realizeVoiceStructureAttack()` がTeacher register/spacingを使いattack毎に再計算 | Voicing競合② |
| City pitches | `buildStableFullVoicings()` + degree-role mask | Voicing競合③ |
| Register | aesthetics / City soft range / Natural preferred range | 3系統 |
| Public passing bass | Block=ROOT_ONLY、Natural=legacy bass除外、City=独立早期return | public 3 stylesでは到達不能 |
| Legacy passing bass | 非公開・保存済みlegacy rhythmから到達可能 | release risk |
| Voicing user selection | 未存在。`octaveShift`だけがdevice preference | 未実装 |

Style pitch invarianceは引き続き **0/24一致**。`accompanimentQualityContract.test.ts` の `it.failing` が既知blockerを固定している。PHASE 1では触れない。

### 9.7 Golden corpus gap

現在のcanonical `GOLDEN_PROGRESSIONS` は6本。September directiveの8本に対して次が不足する。

- `F | G | Em | Am`（P0再現進行）
- `Fmaj7 | G7 | Em7 | Am7`（muddy 7th再現）
- `Cdim | Caug | F | G`

既存6本のうち `D | Bm | G | A` は新directiveに含まれないが、transpose regressionとして削除せず維持する。したがって次のcanonical corpusは置換ではなく **9本**（既存6 + 上記3）とするのが安全。

`dim` / `aug` は既に `CHORD_CATALOG` に合法interval（`[0,3,6]` / `[0,4,8]`）として存在するため、「parser未実装」とは言えない。PHASE 7で必要なのは新規定義よりも、UI到達性・Shared Voicing・transpose/export/playbackを通したend-to-end検証である。

### 9.8 PHASE 0 conclusion

1. P0はHarmony/Voicingより先にnative cold-start境界を調べるべきである。
2. 最有力仮説は「Realtime samplerだけがcount-in後にcold-loadされる」こと。
3. Loop実装を先に変更する根拠はまだない。
4. PHASE 1の最初の変更は診断計測とreadinessの明示化に限定する。
5. P0が10/10実機PASSするまでShared Voicingへ進まない。

---

## 10. PHASE 1 — First Playback candidate

Category: **PLAYBACK only**

Baseline:
`LocalAnalysis/accompaniment_quality/experiments/first-play-01/baseline.json`
（Production変更前、commit `3aeabce`）

### 10.1 Changes

#### Native readiness

- `AudioEngineController.prepare()` がRealtime samplerのdefault pianoを
  `ready`通知前にwarm loadする。
- `ChordAudioModule.play()` がrequest固有のinstrument/program/drum bankを
  count-in開始前にpreflightする。
- `playRealtime()` も同じ`prepareRealtimeInstrument()`を呼ぶ。通常はcache
  hitであり、count-in無し/旧callerにも同じ安全条件を適用する。
- preflight失敗時はcount-inを開始せず、`playRealtime()`の既存failed pathへ
  進む。四カウント後に無音になる失敗形を作らない。

#### Lifecycle serialization

新規`PlaybackLifecycleCoordinator`がService層で以下を担当する。

- concurrent prepareのdedupe
- cold prepareよりplayを先行させない
- newer play wins
- stop/teardownで待機中play generationを無効化
- prepare/teardownを交差させない

音楽時間やMIDI event scheduleは変更しない。

#### Repeated prepare state bug

追加監査で、Editor再生中にGroove screenがmountして`prepare()`を再実行すると、
native stateが無条件に`ready`へ書き換えられることを確認した。音は鳴り続けても
`useLiveSoundReapply()`がtransportをliveと判定できず、Natural→Block→Natural
matrixを壊す。

再利用prepareはengineだけをrearmし、`playing`/`paused`を保持するよう変更した。

#### Diagnostics

同一`PlaybackDiagnostics` timelineに追加:

- `instrument.v2.load.start`
- `instrument.v2.load.end`
  (`cached`, `ok`, `elapsedMs`)
- `countIn.start` / `countIn.handoff`のplan signature
- `play.v2.firstNoteOn` (`pitch`, `beat`)
- `prepare.reuse`のstate
- prepared前count-inの`countIn.reject`

Development buildではcount-in + 1秒後に
`audioService.logPlaybackDiagnostics()`を自動実行するため、Windows + Metro
でもnative timelineを取得できる。音声scheduleには関与しない。

### 10.2 Automated result

`PlaybackLifecycleCoordinator`の8 tests:

- Fresh launch → Loop ON → Play
- Fresh launch → Loop OFF → Play
- Stop → Play
- Loop ON → OFF → Play
- Loop OFF → ON → Play
- Natural → Block → Natural
- Progression change → Play
- cold prepare中のStop

結果:

- Full Jest: **109 suites PASS**
- Tests: **2086 PASS / 1 skipped / 0 failed**
- ESLint（変更TS）: **0 error / 0 warning**
- TypeScript（既知の`dist-check` archiveと既存fixtureを除外）:
  **0 relevant diagnostics**

WindowsにはSwift compilerがないため、internal EAS development build
`aa03b2a7-b1d2-48b1-b481-01e0f1bbcc7b`でnative compileを検証した。
結果は **FINISHED / PASS**（app 1.0.1, build 8, internal distribution）。

### 10.3 Decision

**KEEP / DEVICE PASS**

以下を満たしたため、P0をPASSとして閉じる。

1. EAS build compile PASS（完了）
2. Provisioned iPhoneでrequired matrix PASS
3. true fresh launch 10/10 PASS
4. `countIn.handoff`から`play.v2.firstNoteOn`まで不自然なgapなし

PHASE 2（Shared Base Voicing）のPoC開始条件を満たした。

### 10.4 Device evidence

初回のInternal build cold process startで次を観測した。

- realtime piano preflight: `cached=false` load 10.8 ms（count-inより前）
- count-in直前のpreflight: cache hit 0.8 ms
- `countIn.handoff`: `04:16:39.407Z`
- first chord NoteOn: `04:16:39.409Z`
- handoff → NoteOn: **2 ms**
- engine: `sequencer`
- Natural CC64: **16件到達**

その後、更新buildでuser-observed true process restartを10回実施し、**10/10
PASS**。その最終確認のうちMetroが完全に捕捉した独立cold processは2回で、
それぞれ次の結果だった。

- 07:49 process: handoff → first NoteOn **2 ms**
- 07:52 process: handoff → first NoteOn **3 ms**
- 両方ともSequencer / Drum OFF / Loop ON / CC64 16件到達

手動実機gate 10/10と診断捕捉2/2の双方に失敗なし。pre-fixの遅延値自体は取得して
いないため歴史的root causeの直接計測とは区別するが、release blockerは解消した。

---

## 11. VIDEO PLAYBACK FIDELITY — `video-fidelity-01`

User observation: アプリで試聴した伴奏より動画の伴奏品質が低く、特にNaturalで
差が大きい。

Baseline:
`LocalAnalysis/accompaniment_quality/experiments/video-fidelity-01/baseline.json`

### 11.1 Confirmed root cause

アプリと動画は同じ`buildSessionPerformancePlan()`からpitch/onset/duration/velocity
を作っていたが、その後の音声経路が分岐していた。

```text
App
  FinalMidiSnapshot
    → NativeMidiEvent[] (NoteOn / NoteOff / CC64)
      → RealtimeSamplerEngine
        → AVAudioUnitSampler + FluidR3 GM

Video（変更前）
  Performance notes
    → chordEvents（Noteだけ。CCのfieldなし）
      → AudioEngineController.renderToFile()
        → SampledInstrumentProvider（旧pre-render buffer）
```

実機Natural plan `72eb8624` はApp側でNoteOn 72 / NoteOff 72 / CC64 16を
samplerへ送っていた。一方、video requestはCCを表現できず **CC64 loss 16/16**。
さらにAppは48 kHz live sampler、動画は44.1 kHz pre-rendered note bufferだった。
Naturalだけ差が大きいという報告と一致するため、root causeを **CONFIRMED** とする。

### 11.2 Kept architecture

- 新規`services/videoExport/buildVideoAudioRequest.ts`が
  `FinalMidiSnapshot → buildNativePlaybackPlan()`を唯一の変換経路として使う。
- video requestにrealtimeと同一の`midiEvents`、GM program、drum flag、
  plan signatureを渡す。
- 新規`OfflineMidiRenderer.swift`はstyle/chordを解釈せず、Canonical MIDIを
  sample境界で`AVAudioUnitSampler`へ送る。
- CC64とsame-pitch NoteOff protectionはrealtimeと同じsemantics。
- 旧`chordEvents` rendererは古いJS bundle互換fallbackとしてのみ維持する。

Harmony、Voicing、Natural gesture、gate長には変更なし。

### 11.3 Automated result

- Block/Natural/Cityのvideo payload === realtime payload: PASS
- Natural CC64 count: PASS（Final MIDIと同数）
- Release Cut時CC64 = 0: PASS
- 新規tests: **5/5 PASS**
- Full Jest: **110 suites / 2091 passed / 1 skipped / 0 failed**
- ESLint: 0 errors（今回差分0 warnings、全体の既存warnings 51）
- TypeScript: 今回差分0 diagnostics。全体commandは既存`dist-check/`と
  `projectSummary.test.ts`でexit 2
- iOS Swift compile:
  `bb2b826f-c312-44e6-b145-b32559ea7e6f` **FINISHED / PASS**

### 11.4 Decision

JS/Native payload統合は **KEEP / DEVICE A/B PASS**。

---

## 12. CITY DOWNBEAT / VARIATION UI

### 12.1 Downbeat diagnosis

User observation: Cityの拍頭がだれて聞こえる。

Baseline:
`LocalAnalysis/accompaniment_quality/experiments/city-downbeat-01/baseline.json`

Production Cityは`PerformanceEngine → independentStyles.city →
realizePublicCityType1`でCandidate Bを直接返し、通常のmicro-humanizationを
通らない。Groove assetの全attackはsource MIDIの固定4 tick遅れを保持していた。

- 固定delay: `+0.008333 beat`
- 480 PPQ: 4 ticks
- BPM 100: 5 ms
- hand roll: OFF
- attack overlap: 0

したがって、原因はgate/overlap/voicingではなく、capture phaseをgroove essence
として反復していたこと。

### 12.2 Kept groove change

Production onsetを一律`-0.008333 beat`し、
`[0, 0.5, 0.75, 1.25, 1.75, 2.0]`へ整列した。

不変:

- inter-onset interval
- duration / gap
- velocity
- Candidate B masks
- pitch / voicing
- atomic simultaneous attack

元MIDIのdelayは`sourceContract.sourceGridDelayBeat`に監査情報として残した。

### 12.3 Variation presentation architecture

Cityを`arpeggio`へ移行すると独立rendererと既存project schemaへ波及するため、
永続化モデルは変更しない。新規`features/editor/accompanimentGroups.ts`を
presentation SoTとし、次のUIを構成する。

```text
Block       → block / block.type1
Natural     → natural / natural.type1..3
Variation   → city / city.type1 (label: City)
```

既存City projectは`city / city.type1`のまま読み書きされ、UIだけVariation > City
として表示される。Playback、MIDI、Videoは従来のCity independent rendererへ到達する。
旧`arpeggio.type1..3`はcatalog互換用に残すが、release UIからは非公開。

### 12.4 Gates

- City normalized onsets: PASS
- Candidate B / no roll / subtraction-only: PASS
- City hard gates: PASS
- Public selection groups: Block / Natural / Variation PASS
- Variation child list: City only PASS
- Persisted City ids unchanged: PASS
- Public Harmony/Gate/Register contract including Variation providers: PASS

---

## 13. PHASE 2 — SHARED COMPACT BASE VOICING PoC

Category: **VOICING only**

Baseline / candidate evidence:
`LocalAnalysis/accompaniment_quality/experiments/shared-voicing-01/comparison.json`

### 13.1 Architecture

Production接続前に、新規domain moduleだけでstyle-neutral candidateを作成した。

```text
src/lib/performance/baseVoicing/
  types.ts                  BaseVoicing / preference / hand contract
  handModel.ts              LH 1 / RH 2–4 / total 3–5 / register limits
  CompactVoicingEngine.ts   legal tone selection + compact candidates
  continuity.ts             progression + loop boundary global DP
  index.ts                  public domain API
```

入力は`ChordHarmonyInput`、`position`、`octaveShift`だけで、style、variant、tier、
Teacher MIDIを受け取らない。出力`BaseVoicing[]`はrhythm providerより前の
style-neutral harmonic materialである。

`基本形 / 1st / 2nd`は非slash chordのLH pitch classを選ぶ。slash chordでは明示
bassが常に優先する。RHはuser chord内の2〜4音だけを使い、7th/guide tone、
explicit tension、dim/augのaltered fifthをplain fifthより優先する。

### 13.2 Expanded Golden corpus

Canonical corpusを既存A–FからA–Iへ拡張した。

- G: `F | G | Em | Am`
- H: `Fmaj7 | G7 | Em7 | Am7`
- I: `Cdim | Caug | F | G`

既存Production Hard Gateは拡張後も42/42 PASS。

### 13.3 Measured comparison

Historical Production baseline（3 voicer並立）:

- exact style equality: **0/36 chords**

Shared candidate:

- exact style equality: **36/36 chords**
- Golden A–I × 3 positions: **108 voicings**
- compact failures: **0**
- illegal notes: **0**
- duplicate MIDI: **0**
- inversion failures: **0**
- voice count: min 4 / max 5 / mean 4.417
- max bass jump: **10 semitones**（loop境界含む）
- max top jump: **3 semitones**（loop境界含む）
- all 12 transpositions: PASS

### 13.4 Production promotion

**KEEP / AUTOMATED PASS / DEVICE LISTENING PENDING**

Approved boundary was connected:

1. `progressionToPerfChords()` generates Shared Base Voicing once.
2. Block strikes the exact resolved `bassMidi/bodyMidi`.
3. Natural reads Teacher attack-group onset/gate/velocity, then applies masks to
   the Shared Base. It no longer solves pitch per attack.
4. City applies Candidate B masks to the same Base. Its former independent
   `chordComping/fullVoicing.ts` voicer was deleted.
5. style and tier are not accepted by the Base generation API.
6. `octaveShift` and requested inversion are inputs to the shared engine and
   therefore reach all three styles.

Historical reproducibility is isolated in `progressionToLegacyPerfChords()` for
the pinned Ballad analysis baseline. Teacher-fidelity pitch realization remains
explicitly selectable for forensic validation only; it is not the Natural
Production path.

### 13.5 Production evidence

Post-promotion measurement:

- exact Block/Natural/City Base equality: **36/36**
- identical bass: **36/36**
- identical top: **36/36**
- maximum cross-style bass/top spread: **0 semitones**
- compact/harmony/duplicate/inversion failures: **0**
- all 12 transpositions: PASS
- normal Production invariance gate: PASS
- full Jest: **113 suites / 2119 passed / 1 skipped / 0 failed**
- focused ESLint: **0 errors / 0 warnings**
- quality audit: **5/5 PASS**
- shared-voicing harness: **1/1 PASS**

The promotion did not change rhythm assets, gate policy, velocity policy, CC64,
City onset phase, or persisted style IDs. Natural forensic tests now evaluate
attack groups atomically: onset, median gate, and mean velocity are preserved
without requiring the Shared Base to copy Teacher voice count or pitch layout.

### 13.6 Device-listening register correction

Device listening found all styles higher than intended. This was not preparation
for inversion selection. The pre-Shared-Base device default was
`octaveShift = +1`; after promotion, the shared engine correctly applied that
obsolete default to Block, Natural, and City alike.

Kept correction:

- product default: `+1 → 0`
- default register: LH C2–C3 / RH C3–C5
- old preference key retired; `octave_shift_v2` starts existing installs at the
  neutral register
- an explicit future `+1` preference remains representable
- inversion (`基本形 / 1st / 2nd`) remains independent from register height
- focused register/Shared Base/quality gates: **52/52 PASS**
- full regression: **114 suites / 2124 passed / 1 skipped / 0 failed**

Natural rhythm, velocity, gate, pedal and subtraction masks were not changed in
this correction. The product principle is simple, comfortable comping rather
than maximizing fullness.

---

## 14. SHORT CHORD DURATION AUDIT

User quality baseline after register and short-chord correction: **87/100**.

Scope: mixed 1/4-bar (1 beat), 1/2-bar (2 beats), and full-bar (4 beats)
progressions at 90/132 BPM through the canonical Production Plan.

### 14.1 Result

- Block: PASS
- City: PASS
- Natural baseline: **FAIL**
- missing chord/body attack: 0 in passing styles
- duplicate simultaneous pitch: 0 in passing styles
- invalid duration/start outside chord window: 0 in passing styles

Natural currently computes
`scale = chord.durationBeats / template.meter.beatsPerBar` and maps every
full-bar Teacher attack into each chord. Type1 therefore compresses its eight
half-beat attacks into one beat (eighth-note feel becomes 32nd-note repetition).
This is mechanically legal but not natural or comfortable.

The compressed final attack also lands at 0.875 beat. The global 1/8-beat
anticipation window classifies that old-chord pitch against the next chord,
producing two harmony findings in the mixed fixture. Block and City do not show
this failure.

### 14.2 Kept correction

Add a pure duration policy under `naturalAtomic/`:

- 4-beat chord: preserve the existing full Teacher bar
- 2-beat chord: use the uncompressed first two beats
- 1-beat chord: use the uncompressed first beat
- clip gate and pedal release to the chord boundary
- never change Shared Base pitch, velocity identity, style storage, or other
  public styles

Production result:

- Natural 4-beat chord: existing Teacher timeline unchanged
- Natural 2-beat chord: uncompressed first two beats
- Natural 1-beat chord: uncompressed first beat
- maximum Natural attack density: 2 attack groups/beat
- short-chord harmony findings: **2 → 0**
- CC64 state at every short chord boundary: up
- mixed-duration matrix at 90/132 BPM: **6/6 PASS**
- focused duration/identity/quality regression: **69/69 PASS**
- full regression: **116 suites / 2134 passed / 1 skipped / 0 failed**

`shortChordDurations.test.ts` is now a normal permanent passing gate.

---

## 15. V1.0.2 — 87-POINT AUTHORITY AND VOICING CONTROL

### 15.1 Approved checkpoint and deterministic authority

The user-approved 87/100 state is preserved at commit `ddf2602`. A versioned
fixture now hashes the exact Shared Base, pitch, onset, gate, velocity and CC64
events for Golden A–I × the five public Types:

- tracked digests: **45**
- exact matches after v1.0.2 wiring: **45/45**
- default position: `root`
- update authority: intentional sound change + all Hard Gates + device score
  at least 87 + Quality Ledger update
- new Types add keys and may not rewrite existing digest keys

This gate is complementary to semantic quality contracts: the digest detects any
audible event change, while the semantic gates explain whether harmony, register,
pedal, silence and style invariance remain legal.

### 15.2 Project-owned voicing preference

`VoicingPosition` remains defined only in `baseVoicing/types.ts`. The selected
value now reaches:

1. SQLite Project row (`voicing_position`, root-default migration)
2. Project repository normalization and upsert
3. Editor Session load/save and dirty tracking
4. live sound re-apply signature
5. realtime playback and preset playback
6. single-chord preview and export keyboard preview
7. Standard MIDI and video/offline audio export

The Groove screen adds a thin `基本形 / 1st / 2nd` selector. Style changes do not
change it, and slash bass still overrides inversion at the Shared Base boundary.
Legacy, missing and invalid persisted values normalize to `root`.

### 15.3 Automated candidate evidence

- Project migration/default/write: PASS
- preview root/first/second and slash bass: PASS
- video performance input propagation: PASS
- Style/Tier invariance for all positions: PASS
- all 12 transpositions: PASS
- TypeScript: PASS
- quality audit: **5/5 PASS**
- Shared Voicing harness: **1/1 PASS**
- full Jest: **121 suites / 2147 passed / 1 skipped / 0 failed**
- internal iOS/Swift build: **PASS**, build
  `73c6cbb2-0763-44d5-b454-d971207ff412`

The remaining release boundary is the internal-device matrix. Production build,
App Store submission and baseline digest replacement remain outside this phase.

---

## 16. BUILD 9 DEVICE REJECTION — NATURAL TYPE IDENTITY

Device listening rejected build 9 for two concrete reasons:

1. Natural Type1/2/3 differed only through Teacher MIDI takes routed through one
   common extraction/mask policy, so their product identities were not obvious.
2. Inversions changed the LH bass degree, but RH continuity could retain a very
   similar hand shape, making the overall difference subtle.

### 16.1 Build 10 candidate

Natural now selects an explicit rhythm Strategy by public variant ID:

- Type1: two long attacks at beats `0, 2`
- Type2: five attacks at `0, 1, 1.5, 2.5, 3` for phrase bars 1–3 and three
  attacks at `0, 1, 1.5` for bar 4
- Type3: four short attacks at `0, 1, 2, 3`
- 1/2- and 1/4-bar chords take the uncompressed prefix

Teacher pitch remains unread. Shared Base, mask subtraction, CC64 handling,
harmony legality and Style pitch invariance remain in their existing layers.

For `1st` and `2nd`, the RH is now anchored to the next available chord tone
above the requested LH inversion bass. `root` candidate generation is unchanged,
and slash bass bypasses the inversion anchor.

### 16.2 Automated evidence

- exact public Natural attack signatures: **4/4 PASS**
- new rhythm/profile and Shared Base focused tests: **48/48 PASS**
- Hard Gate / short chord / style invariance: **54/54 PASS**
- quality audit: illegal pitch 0; Natural rest rate 1.0; overlap 0
- Shared Voicing: 108 voicings, compact/harmony/duplicate/inversion failures 0
- maximum top jump across inversion candidates: 10 semitones
- candidate suite excluding the intentionally held approval digest:
  **122 suites / 2157 passed / 1 skipped**
- unchanged approved digest keys: Block/City **18/18**
- intentionally changed Natural keys: **27**, not approved yet
- internal iOS/Swift build: **PASS**,
  `76ec5312-1c67-49cf-8621-2ba8b3ddf5da`

Build 10 passed device listening on 2026-08-19. The 27 intentional Natural keys
were promoted into the v87 fixture; all 45 public-Type digests now pass. Final
approved regression: **123 suites / 2158 passed / 1 skipped / 0 failed**.

---

## 17. BUILD 11 — PER-CHORD VOICING, NATURAL REASSIGNMENT, RESUME RECOVERY

### 17.1 Per-chord Voicing authority

The Project-wide selector was not the requested interaction. Build 11 makes
`ChordEvent.voicingPosition` the Production authority and places the selector in
the existing long-press chord context menu.

Architecture:

1. Legacy `projects.voicing_position` is consumed only as a read-migration
   fallback and copied into events that lack their own position.
2. New writes keep the old SQL column at `root`; the `chord_events` JSON owns
   `root / first / second`.
3. `buildCompactBaseVoicingsWithPreferences()` builds one candidate layer per
   chord preference and still selects the complete progression with the existing
   continuity DP.
4. Block, Natural and City receive the same per-chord Base, preserving Style
   pitch invariance.
5. Slash bass still overrides the requested inversion.

No second voicing engine or screen-owned music logic was added.

### 17.2 Natural Type reassignment

The accepted beat grid is:

- Type1: `0, 1, 1.5, 2.5, 3` on all phrase bars
- Type2 RH: `0` with a 2.75-beat gate, then a short attack at `3.5`
- Type2 LH: exactly one Shared Base bass note from chord onset to chord boundary
- Type3: unchanged `0, 1, 2, 3`

Type2 uses a subtractive `RIGHT_HAND` mask for its RH attacks; it does not
revoice or add pitch. Its template pedal is omitted so the 0–3.5 rest remains
real, while the independently gated LH provides the requested continuous bass.
One- and two-beat chords keep uncompressed prefixes.

### 17.3 Background resume root cause and correction

The generated/native plan was not monophonic: device diagnostics showed 44
scheduled chord NoteOns, pitch range 36–65 and three active keys. The structural
failure was inside `RealtimeSamplerEngine`:

1. `pause()` saved the beat, cancelled work and sent All Notes Off.
2. `resume()` called `play(startBeat:)`.
3. Scheduling discarded every event before `startBeat`.
4. Notes and CC64 already active at that beat were never reconstructed.
5. The next sparse mask could therefore be a single LH note.

Build 11 simulates the MIDI timeline up to the resume beat and restores:

- active keyed voices, including same-pitch gate depth
- pedal-held released voices
- latest controller state, including CC64

Future events are then scheduled as before. AppState transitions are serialized:
backgrounding pauses once, foregrounding reactivates/prepare-rearms the engine,
and playback never auto-resumes unexpectedly.

### 17.4 Current evidence and authority boundary

- TypeScript: PASS
- canonical lint: 0 errors (46 pre-existing warnings)
- targeted Voicing/Natural/lifecycle/Hard Gate: PASS
- full suite: 123 suites / 2165 passed / 1 skipped
- approved authority: Build 11 Natural Type1/2 replaced exactly 18 keys after
  device PASS; all 45 current keys are exact
- unchanged from Build 10: Block, City and Natural Type3, 27/27 exact
- Swift compile: **PASS**, internal build
  `5bda9432-7e1e-4c63-a6b1-817b1e936a6e`
- device listening/background matrix: **PASS**

The Build 11 Natural rhythm and resume behavior passed on device. Its 18 intended
Natural digest changes are now part of the tracked 87/100 authority.

---

## 18. BUILD 12 — CHORD PREVIEW LIFETIME

The editor chord-card sound effect is outside Final MIDI and accompaniment
generation. Two defects were confirmed in that isolated Preview path:

1. A fixed two-beat request made audition length tempo-dependent (1.2 seconds at
   100 BPM and 0.67 seconds at 180 BPM).
2. Each realtime audition left an independent delayed NoteOff. If the next chord
   shared a pitch, the old closure could stop that pitch in the new audition.

Build 12 defines a feature-owned two-second wall-clock Preview policy. It also
writes an equivalent beat value for Build 11 native compatibility. The native
record accepts `durationSec` as the new authority.

`RealtimeSamplerEngine` now owns Preview notes by generation:

- starting a new audition stops only the prior Preview notes
- generation increments before the new notes start
- delayed NoteOff executes only if its generation still owns the audition
- All Notes Off invalidates Preview ownership before transport work continues

The sampled fallback applies a Preview-only 250 ms smooth release. Authored
accompaniment gates, CC64, Shared Base, style rhythm, Export and video are not
changed. Therefore the Build 11 45-digest authority must remain exact.

Automated evidence before native build:

- Preview timing policy: PASS at 60/100/180 BPM
- Build 11 accompaniment authority: 45/45 exact
- TypeScript: PASS
- canonical lint: 0 errors (46 pre-existing warnings)
- full regression: **125 suites / 2171 passed / 1 skipped / 0 failed**
- Swift compile / internal Build 12: **PASS**
  (`9df25e88-2978-4acc-8941-1d8a24efef24`)

---

## 19. BUILD 16 — VARIATION DANCE PROFILE

Dance is an additive rhythm/pedal provider, not a new voicing engine. The
Production dependency direction is:

```text
Variant ID → Groove Profile Registry → rhythm/pedal declarations
User chord → Shared Base Voicing → subtractive attack mask → Final MIDI
```

`danceGrooveProfile.ts` owns one measured six-group gesture and controlled-long
CC64 declaration. `grooveProfileRegistry.ts` is the extension point shared by
existing Natural candidates and Dance, so future profiles do not require a new
renderer branch. The atomic Natural renderer remains the sole realization path.

Forensic boundary:

- copied: onset, gate, velocity, pedal and simultaneous Attack Group structure
- forbidden: source pitch, pitch class, key, chord, progression and melody
- emitted pitch: unchanged `bassMidi/bodyMidi` subset only
- persistence: `natural / natural.dance1`; no DB migration
- presentation: `Variation / Dance`
- release authority: device listening required before freezing a Dance digest

Automated evidence:

- exact six-group identity: PASS
- full-bar and 1/2/1-beat uncompressed prefixes: PASS
- Golden A–I × root/1st/2nd Shared Base invariance: PASS
- all 12 keys, slash bass, 7th/aug/dim, range/crossing/duplicate gates: PASS
- controlled CC64 Up at 3.85 and every chord boundary: PASS
- `releaseCut` CC64: 0
- live/MIDI/video canonical Final MIDI path: PASS
- existing release and Natural candidate digest changes: 0
- full regression: **130 suites / 2242 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 16: **PASS**,
  `36b98b97-7186-4d95-9326-5b181cb71784`

---

## 20. BUILD 17 — DANCE HAND DYNAMICS / ARPEGGIO RESONANCE

Build 16 Dance received **60/100** on device. Its onset/gate/mask/pedal contract
was correct, but the renderer applied one Attack Group mean velocity to every
selected note. The source's defining low-to-high RH hierarchy (`77/81/93` and
`77/85/97`) was therefore absent.

Build 17 adds a pure `attackVelocityPolicy.ts` after subtractive note selection.
Profiles may declare an LH value and a pitch-independent RH rank envelope. The
policy resamples the envelope to the available Shared Base voice count and may
change velocity only. Existing profiles omit the shape and remain byte-for-byte
compatible.

Arpeggio `natural.type5` changes from eight to seven attacks:

```text
0 BASS → 0.5 RH_BOTTOM → 1 RH_MIDDLE → 1.5 RH_TOP
→ 2 REST → 2.5 RH_MIDDLE → 3 RH_BOTTOM → 3.5 BASS
```

The removed second apex becomes a controlled resonance window. CC64 is Down at
0, Up at 3.9 and forced Up at every chord boundary; `releaseCut` emits no CC64.
The same Final MIDI remains authoritative for live playback, MIDI and video.

Protected boundaries:

- Dance pitch/onset/gate/mask/pedal: unchanged
- Shared Base and harmony: unchanged
- Block/Natural Type1/City 27 release digests: unchanged
- Natural Type2/3/4 note digests: unchanged
- source pitch/key/chord/progression data in Production: 0
- full regression: **132 suites / 2251 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 17: **PASS**,
  `f7f3aff7-76e6-4b5d-b226-1db98933e706`

---

## 21. BUILD 18 — DANCE PHRASE / CANONICAL SUSTAIN ORDER

Build 17 device listening approved Arpeggio but rejected Dance again for weak
groove. The accepted Arpeggio note/CC64 schedule is now frozen by SHA-256 digest
`4ff013c...f0834`; Build 18 does not alter its profile.

Dance remains a declarative provider in `grooveProfileRegistry.ts`, but its
one-bar literal source translation is replaced by a product `DESIGN_TARGET`:

```text
A/B/A: 0 SHELL → 0.5 FULL → 1.5 RH → 2.5 FULL → 3.5 RH
D:     0 SHELL → 0.5 FULL → 1.5 RH → 2.5 FULL → REST
```

The beat-0 shell is deliberately weak. Offbeat attacks are short and stronger,
and CC64 is limited to `0.5–0.92` and `2.5–2.92`. This preserves key and pedal
silence rather than filling the rhythm with the rejected long pedal wash.
Shared Base, pitch ownership, persistence ID and the atomic renderer are
unchanged.

The common Sustain correction is below Style/Profile logic. New pure
`midiExport/eventOrdering.ts` defines one same-instant order:

```text
Program → NoteOff → CC64 Up → CC/CC64 Down → NoteOn
```

Both realtime/native event flattening and the SMF writer consume this policy.
Offline video already consumes the flattened native order. Adjacent chord
re-pedaling can therefore no longer depend on JavaScript sort stability or leave
the sampler in an accidental Pedal Up state.

Automated evidence:

- Dance four-bar Attack Group counts: `5 / 5 / 5 / 4`
- Dance short pedal windows and every chord-boundary Up: PASS
- Live and SMF same-beat `Off / Up / Down / On`: PASS
- approved Arpeggio digest: exact
- protected release/Natural candidate digests: exact
- full regression: **132 suites / 2253 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 18: **PASS**,
  `9d9ee09d-113f-4f1c-94c0-73981900f617`

---

## 22. BUILD 19 — MEASURED DANCE PULSE PROVIDER

Build 18 device listening approved the common Sustain correction but rejected
Dance accompaniment quality. The earlier isolated piano MIDI did not represent
the overall groove the owner wanted. The owner therefore supplied a full-mix
reference and identified `00:35–01:05` as the Dance target.

The reliable pitch-independent audio measurements are:

- approximately 128–129 BPM
- harmonic median inter-onset interval 0.232 seconds (one eighth note)
- Bass-band attack presence 80–93% on each eighth-note offbeat
- stable 10-second harmonic density `42 / 46 / 47`
- no measured fourth-bar density drop
- tightly gridded attacks; no evidence supporting random Humanize

`dancePulseProfile.ts` is a new declarative Provider behind the persisted
`natural.dance1` identity. `danceGrooveProfile.ts` becomes a compatibility
facade, so the registry, renderer, UI and saved projects remain unchanged.

```text
0 FULL → 0.5 BASS → 1 RH → 1.5 BASS
→ 2 FULL → 2.5 BASS → 3 RH → 3.5 BASS
```

The four-bar topology is `A / B / A / B` with constant attack density. A/B
variation changes accents only. Pitch remains an unchanged Shared Base subset;
the Provider owns timing, gate, velocity, role selection and short chord-anchor
CC64 windows only. Driving and every other Style are outside this change.

Automated evidence:

- Dance four-bar Attack Group counts: `8 / 8 / 8 / 8`
- all four offbeats resolve to exactly one Shared Base Bass note
- full anchors, RH responses and short-chord prefixes: PASS
- all-key harmony, inversion, slash-bass, range and duplicate gates: PASS
- approved Arpeggio digest: exact
- protected release/Natural candidate digests: exact
- full regression: **132 suites / 2253 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 19: **PASS**,
  `2b38792c-91b4-47fc-bd1e-35ae79221c97`

---

## 23. BUILD 20A — AUDIO SAMPLE-CLOCK MIDI SCHEDULER

The owner reported rare timing disruption without a reproducible Style or user
action. Final MIDI generation is deterministic, but the Build 19 realtime engine
submitted every NoteOn, NoteOff and CC through its own
`DispatchQueue.asyncAfter`. Dispatch deadlines are not audio deadlines: under
system load the queue may wake after the intended instant.

Build 20A adds `SampleAccurateMidiScheduler.swift`, a transport-only component
with no knowledge of chords, Styles or harmony. It observes each sampler's
pre-render callback, maps beat time to sample frames once, and submits only the
events that belong to the current audio buffer:

```text
Final MIDI beat
  → shared chord/drum sample-time origin
  → current render-buffer frame offset
  → AUAudioUnit.scheduleMIDIEventBlock
```

Chord and drum samplers use separate render observers but one
`SampleAccurateMidiClock`, preventing a one-buffer route skew. Looping advances
an event cursor on the audio clock rather than arming the next loop from a wall
clock timer. Stop and pause clear scheduler state, so no future NoteOn has been
queued beyond the current render buffer.

Same-pitch lifetime resolution remains necessary because a sampler NoteOff can
otherwise cut an overlapping re-attack. Build 20A performs that resolution once
on the control thread before playback. The render callback therefore does not
acquire the gate's `NSLock` or mutate its dictionary.

Protected boundaries:

- Final MIDI notes, CC64, onset, gate, velocity and canonical event order: unchanged
- Style providers, Shared Base Voicing and Harmony Gate: unchanged
- MIDI and offline video rendering: unchanged
- Preview duration timer: unchanged; it is not accompaniment musical time
- no dependency or persistence change

Automated evidence:

- render-observer/frame-offset source contract: PASS
- no event-level realtime accompaniment `asyncAfter`: PASS
- shared chord/drum sample origin: PASS
- canonical Native MIDI order: PASS
- full regression: **133 suites / 2257 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 20: **PASS**,
  `fd03d5f9-e21c-44bd-be82-4d88de92e125`

---

## 24. BUILD 21 — STYLE SUSTAIN AND ACCOMPANIMENT SPACE

Build 20A device listening accepted the common audio sample-clock scheduler.
Build 21 freezes that transport and separates two requested sound changes.

CC64 remains owned by the declarative Natural profile:

```text
Type2:   Down 0 → Up 3.9
Driving: Down/Up 0/0.82 → 1/1.95 → 2/2.82 → 3/3.95
```

Type2 now rings through one full chord. Driving keeps short windows around its
main anchors while its two 16th-note turns remain under pedal through the final
single attacks at `1.75/3.75`. Note onset, gate, velocity and pitch are unchanged.
Short-chord realization still injects Pedal Up at every harmonic boundary.

Reverb is not represented as MIDI or placed in UI logic. New pure
`performance/space/accompanimentSpaceProfile.ts` maps stable variant identity to
one semantic audio profile:

```text
natural.type3 (Funk) → Small Room / 8%
city.type1 (City)    → Small Room / 8%
everything else      → Off / 0%
```

The JS audio service passes that profile to both realtime and video render
requests. The Expo bridge defaults missing fields to dry for old bundles.
Realtime and `OfflineMidiRenderer` each route only the chord sampler through an
`AVAudioUnitReverb`; the drum sampler remains direct. Native clamps wet mix to
`0...100`.

Protected boundaries:

- Build 20A sample-clock scheduler and event timing: unchanged
- MIDI notes/onsets/gates/velocities and Harmony Gate: unchanged
- SMF export: no audio reverb metadata
- preview and drum paths: dry
- UI, persistence IDs and DB schema: unchanged

Automated evidence:

- Type2/Driving pedal profile and chord-boundary gates: PASS
- Funk/City 8% Provider; all other Styles dry: PASS
- realtime/offline native room routing source contract: PASS
- focused Sustain/Room regression: **7 suites / 53 passed / 0 failed**
- full regression: **135 suites / 2274 passed / 1 skipped / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- internal iOS/Swift Build 21: **PASS**,
  `c9e63333-fe2f-488c-b95a-925f7931685d`

---

## 25. BUILD 22 — DANCE MIDI-REFERENCE PROVIDER

Build 21 device listening accepted Type2 Sustain, Driving Sustain and the
Funk/City room profile. Build 22 freezes those paths. The owner designated
`hipnotize piano.mid` (SHA-256 `ee9dd75b...deec91`) as the exact Dance reference,
superseding Build 19's full-mix eighth-note pulse.

The new `danceReferenceMidiProfile.ts` is a declarative provider behind the
existing `danceGrooveProfile.ts` facade:

```text
natural.dance1
  → Groove Profile Registry
  → eight-bar onset/gate/velocity/role declarations
  → Shared Base Voicing
  → subtractive selection
  → canonical Final MIDI
```

Measured phrase:

```text
bars 1–6: 0 FULL → 1 RH → 1.5 BASS+RH_BOTTOM → 1.75 RH → 2.5 RH → 3.5 RH
bar 7:    0 FULL → 1 RH → REST → 1.75 RH → 2.5 RH → 3.5 RH
bar 8:    0 BASS → 0.0438 RH roll → 1 RH → 1.75 RH → 2.5 RH
          → 3 BASS+RH split gate → 3.5 RH accent
```

`NaturalAttackVoicingSelection` gains one additive `VOICE_ROLES` form. It
resolves each requested hand/rank from the already-completed Full Voicing,
deduplicates by pitch and returns a subset. It cannot add, transpose, double or
revoice a note. The compatibility mask for mixed Bass/RH selection is `SHELL`.
Existing `MASK` and single `VOICE_ROLE` behavior is unchanged.

The shared rhythm entry point previously reduced `chordIndex` modulo four before
calling a Strategy, making any eight-bar provider unreachable. It now passes the
phrase index unchanged. Existing Type2–5 Strategies still apply their own
four-bar modulo; only Dance resolves modulo its eight-bar provider length.

Pedal authority for Dance is `NONE`. The reference has no CC64 events; its
96.84% key-sounding ratio comes from written 0.5/1.0-beat gates and overlap.
Bar 8's 0.0438-beat roll is the only retained non-grid offset. No random timing
or source pitch identity is imported.

Protected boundaries:

- persisted ID, UI group and DB schema: unchanged
- Build 20A sample-clock scheduler: unchanged
- Build 21 Type2/Driving pedal and Funk/City room: unchanged
- source pitch/key/chord/progression/melody in Production: 0
- every Dance pitch: unchanged Shared Base subset
- approved Arpeggio and protected release digests: unchanged

Automated evidence:

- eight-bar unique Attack Group counts `6/6/6/6/6/6/5/7`: PASS
- multi-role subtraction and compatibility mask: PASS
- Golden A–I × root/1st/2nd, all keys and slash bass: PASS
- uncompressed short-chord prefixes: PASS
- Dance CC64 in live/video Final MIDI: 0
- focused Dance/Natural Atomic regression: **8 suites / 57 passed / 0 failed**
- TypeScript: PASS
- canonical lint: **0 errors / 46 existing warnings**
- full regression: **135 suites / 2278 passed / 1 skipped / 0 failed**
- internal iOS/Swift Build 22: **PASS**,
  `22f9f87b-fff5-41e3-a554-d112f2e8c260`
- Build 22 all-Style real-device listening: **PASS — release authority**
