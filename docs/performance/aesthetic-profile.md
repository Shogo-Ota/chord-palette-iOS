# 演奏の美学プロファイル（Aesthetic Profile）

## 目的と原則

参照MIDI（例: `docs/midi-references/Good_Song_Chords_Top_10.mid`）を **そのまま再生・コピーするのではなく**、
「人が心地よいと感じる演奏の法則（美学）」を **定量的に抽出** し、
**どんなコード進行にも当てはめられる進行非依存のパラメータ** に落とし込む。

原則:

- **コピーせず、美学を抽出する** — 音そのもの（キー/メロディ/コード選択）は学習対象にしない。抽出するのは「アタックのタイミング・強弱・長さ・配置の傾向」だけ。
- **確率骨格 + 上限** — ルールは per-step のヒット確率や per-rule の発火確率＋1フレーズあたりの上限で表す（`CappedRule`）。「毎小節すべてに適用しない／変化させすぎて特徴を失わない」ため。
- **シード決定論** — すべての揺らぎは `streamFor(seed, ...)` 由来で `Math.random` を使わない。同じ seed は同じ演奏を再現する。
- **層分離** — Groove Template → Musical Variation → Micro Humanization の3層 + Voicing（転回/オクターブ）+ 可聴性ガード。各軸は対応する層のパラメータへ写像される。

## パイプライン

```
Progression
  → Voicing / VoiceLeading（転回・オクターブ・register）
  → PerformanceEngine
      1. Groove Template   : StylePreset（hits/accent/gate/microtiming/velocity/strum）
      2. Musical Variation : VariationProfile（rests/ties/twoFourBar/phraseFill/bassOnly）
      3. Micro Humanization: timing jitter / velocity humanize / gate
  → ensureChordAudible（可聴性の安全網）
  → NoteEvent[]
```

## 9軸 → 定量指標 → 対応パラメータ

| 軸 | 定量指標（測り方） | 対応パラメータ（実装） |
|---|---|---|
| タイミングのズレ | 各ヒットのグリッドからのms偏差の平均/分散、小節共有の押し/引き | `StylePreset.kickFeelMs`（小節共有フィール）+ `microtiming[track]: MsRange`（トラック別ジッタ）+ feel `humanizeScale`、`tempoTimingScale(bpm)` |
| ベロシティ分布 | ステップ別の平均velocity、アクセント比、2/4小節のフレーズ山、ゴースト帯 | `VelocitySpec`（center/accentDepth/phraseDepth/humanizeMin-Max/ghostMin-Max）+ `StepPattern.accent[]` |
| ノート長 | body note 長の中央値（`bodyDurMed`）、gate比 | `GateSpec { min, max, sustain }` + `releaseCut` + tie/sustain |
| ストラム時間 | 和音内オンセットの微小な時間差（ロール）、方向・velocity減衰 | **`StrumSpec { spreadMs, direction, humanizeMs?, velocityFalloff? }`（本提案で新設）** |
| 転回形 | 隣接和音間の平均ボイス移動量、共通音保持率 | `voiceLeading`（全転回×オクターブ列挙→コスト最小、`maxVoiceStep`/`stepPenalty`）+ `VOICING_AESTHETICS` |
| オクターブ配置 | body/bass の register 中心・上下限 | `voicing`（`CHORD_ROOT_MIDI`/`BASS_ROOT_MIDI`）+ `VoiceLeadingOptions.floorMidi/ceilMidi/targetCenterMidi` + `octaveShift` |
| ベースライン | `bassHits` のステップ分布（walking/sparse/dense） | `StylePreset.bass: StepPattern` + `NATURAL_BANK`（naturalComp / Sparse / Dense） |
| シンコペーション | off-beat ヒット率、食い（先取り）の発生 | off-beat `hits[]` + `AnticipationSpec { maxLeadBeats }` + Variation `ties` |
| 音を抜く傾向 | 休符率、bass のみ小節の頻度 | `VariationProfile.rests` / `bassOnly`（`CappedRule { probability, maxPerPhrase }`） |

`.rhythm.json` の各フィールドとの対応:

- `bodyHeat[16]` → chord/top の `StepPattern.hits[]` と `accent[]`（heat をしきい値化してヒット、値をアクセントへ）
- `chordHits30` / `topHits40` → chord / top のヒット候補
- `bassHits20` → `bass.hits[]`
- `bodyDurMed` → `GateSpec`（1beatグリッドで body 長 ≒ 中央値になる gate）

## AestheticProfile スキーマ（提案）

既存の型を束ねる「上位スペック」。ランタイムで重複する型は作らず、抽出結果をこの形にまとめることを想定した **仕様** として定義する。

```ts
// 提案（文書内スペック）: 1つの美学 = 生成に必要なパラメータの束
interface AestheticProfile {
  id: string;
  displayName: string;
  /** 各フィールがローテーションする Groove Template（1つ以上）。 */
  templates: StylePreset[];          // hits/accent/gate/microtiming/velocity/(+ strum)
  /** 意図的変化（休符・タイ・2/4小節・フレーズフィル・bassのみ）。 */
  variation: VariationProfile;
  /** micro-humanization 窓の倍率。 */
  humanizeScale: number;
  /** 転回・オクターブの美学（register中心・上下限・トップ/レジスタ重み）。 */
  voicing: VoiceLeadingOptions;
}
```

## 抽出関数のシグネチャ（提案・実装は対象外）

`.rhythm.json` 形状の解析結果から `AestheticProfile` を生成する純関数。今回は **シグネチャの提案のみ**（パイプライン本体は別スプリント）。

```ts
/** `.rhythm.json` の形（抜粋）。アタック・タイミングのみを対象にする。 */
interface RhythmAnalysis {
  stepsPerBar: number;                 // 16
  beatsPerBar: number;                 // 4
  aggregate: {
    bodyHeat: number[];                // 0..1 × stepsPerBar
    suggestedChordHits: boolean[];
    suggestedChordHits8th?: boolean[];
    bodyHeat8th?: number[];
  };
  sectionsAnalyzed?: Array<{
    bars: number;
    bodyHeat: number[];
    chordHits30: boolean[];
    bassHits20: boolean[];
    topHits40: boolean[];
    bodyDurMed: number;                // beats
  }>;
}

/** 抽出パラメータ（しきい値・平滑化・humanize 幅など）。 */
interface ExtractionParams {
  chordHeatThreshold: number;          // heat→hit のしきい値（例 0.3）
  bassHeatThreshold: number;
  topHeatThreshold: number;
  accentFromHeat: (heat: number) => number; // heat→accent 0..1
  gateFromBodyDur: (medBeats: number) => { min: number; max: number };
}

/**
 * 参照解析 → 進行非依存の AestheticProfile。
 * コピーではなく骨格（確率/アクセント/長さ）だけを写像する純関数。
 */
declare function extractAestheticProfile(
  analysis: RhythmAnalysis,
  params: ExtractionParams,
): AestheticProfile;
```

将来この関数を実装すれば、新しい参照MIDIの解析JSONを渡すだけで **データとして** 新しいフィール（StylePreset群）を追加でき、手作業の写経が不要になる。

## 今回実装する不足軸

- **ストラム時間**: `StrumSpec` を新設し、ブロック和音の同時打鍵に手弾き感の微小オフセット（ロール）を付与。純関数 `strumOffsetBeats` / `strumVelocityScale` を `PerformanceEngine.renderTrack` の chord ブロックに適用（アルペジオ/単音は不変、音符窓を越えないようクランプ、シード決定論）。
- **転回・オクターブ美学**: `VOICING_AESTHETICS`（`balanced` / `warmLow` / `brightOpen`）を明示化し、フィール別に保守的にマッピング（既定 `balanced` = 現行出力を維持）。

いずれも純ドメインの変更で、ネイティブ非依存・EASリビルド不要。
