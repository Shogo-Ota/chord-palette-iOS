# 伴奏アーキテクチャ監査 — PHASE A / PHASE B

§1〜§6 は PHASE A（監査時点の実装をコード変更なしで追跡）。§7 以降が PHASE B（Hard Gate 化と最初の PDCA `gate-01`）の結果。

- 測定コマンド: `npm run quality:audit` / `npm run quality:gate01`
- 測定成果物: `LocalAnalysis/accompaniment_quality/audit_phase_a/`、`.../experiments/gate-01/`
- 測定対象: Golden Progressions A–F（directive §30 準拠、`src/lib/midiQa/goldenProgressions.ts`）
- 品質台帳: `LocalAnalysis/accompaniment_quality/current_status.json`

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
