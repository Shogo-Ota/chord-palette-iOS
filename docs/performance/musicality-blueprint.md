# ワンタップで“プロっぽい”伴奏 — 音楽性ブループリント（設計提案）

> ステータス: **提案（未承認・コード変更なし）**。承認後に段階実装します。
> 関連: [aesthetic-profile.md](./aesthetic-profile.md)（9軸→パラメータ対応・抽出関数シグネチャ）

## 0. 参考資料の扱い（コピーしない原則）

参考の YouTube チャンネル／動画・参照 MIDI は「どう弾くと人が気持ちいいか」の**一般的な音楽理論・演奏ノウハウ・設計思想**を抽出するためだけに使う。特定の楽曲・キー・メロディ・コード選択は学習対象にしない。学習・抽出するのは以下の**進行非依存の傾向**のみ:

- アタックのタイミング傾向（ズレ・押し引き）
- 強弱（ベロシティ）の分布・アクセント位置
- ノート長（ゲート）・音の抜き方
- 和音内の時間差（ストラム）
- 転回形・オクターブ配置の傾向
- ベースラインの動き方
- シンコペーション（食い）の起こり方

これらは音楽理論の一般則であり、著作物ではない。抽出結果は確率骨格＋上限＋シード決定論で表現する（[aesthetic-profile.md](./aesthetic-profile.md) の原則を踏襲）。

---

## 1. 全体アーキテクチャ（レイヤと拡張点）

「複数のチャンネル／MIDI を後から追加してもチェーンを蓄積できる」を満たすため、**Source（供給）→ Registry（蓄積）→ Resolver（解決）→ Engine（生成）** の 4 段で分離する。既存の `PerformanceEngine` はそのまま最終段に置く。

```
┌─ MusicalitySource（Provider） ───────────────────────────┐
│  MidiAnalysisSource / CuratedSource / (将来) ChannelSource │  ← 追加はファイル追加のみ
│    each yields → AestheticProfile[]                        │
└───────────────────────────┬───────────────────────────────┘
                            ▼
                 AestheticProfileRegistry        ← 蓄積（provenance/version 付き）
                            │
                            ▼
   ProfileResolver（feel + tier + tempo → 1つの ResolvedProfile）
                            │
        ┌───────────────────┼───────────────────┬───────────────┐
        ▼                   ▼                   ▼               ▼
 ProgressionStrategy   VoicingAesthetic   GrooveTemplate/Feel  MelodyStrategy
 (コード進行の提案)    (転回/オクターブ)   (リズム/グルーヴ)    (メロディ・トップ声部)
        │                   │                   │               │
        └───────────────────┴─────────┬─────────┴───────────────┘
                                       ▼
                              PerformanceEngine（既存）
                              → NoteEvent[] → Renderer/Native
```

**設計原則（ユーザールール準拠）**

- ドメインは RN/Expo/Native 非依存の純関数（`src/lib/**`）。
- 拡張は Strategy / Provider / Registry / Factory パターン。既存の安定コードは編集せず、新規ファイルで足す。
- UI にビジネスロジックを書かない（Service/hook 経由）。
- 巨大 switch・God class を避ける。1 クラス 1 責務。

---

## 2. 5 つの音楽ドメインの体系化 → 実装写像

### 2.1 コード進行の考え方（ProgressionStrategy）

**一般則（抽出する思想）**

- 機能和声: Tonic(T) → Subdominant(SD) → Dominant(D) → T の引力。定番進行（I–V–vi–IV、ii–V–I、カノン、王道 4536 等）は「機能の並び」に還元できる。
- 代理和音: iii/vi は T の、ii は SD の、vii° は D の代理。
- 平行・終止感: 半終止 (…→V)、完全終止 (V→I)、偽終止 (V→vi)。
- ペダル/共通音でつながる進行は滑らかに聞こえる。

**実装写像**

- 進行は既に degree ベース（`ChordEvent.rootOffset`/`suffix`、`Preset.chords`）。ここへ「次に来ると気持ちいい和音の候補」を返す `ProgressionStrategy` を追加。
- 定番進行は**テンプレート（機能列）**として data 化。ユーザーが 1 つ置くと「続き候補」を関数（function）ラベル付きで提案 → ワンタップ追記。
- Pro 差分は候補の**質**（テンション/セカンダリドミナント/モーダルインターチェンジを候補に含めるか）で出す（→ §8）。

```ts
// 提案（新規 src/lib/theory/progression/ProgressionStrategy.ts）
export interface ProgressionSuggestion {
  chord: PresetChord;          // degree ベース（既存型を再利用）
  reason: 'functional' | 'cadence' | 'secondaryDominant' | 'modal' | 'commonTone';
  isPro: boolean;              // 有料候補か
  score: number;              // 0..1 「気持ちよさ」推定（決定論）
}
export interface ProgressionStrategy {
  readonly id: string;
  /** 現在の進行に続く候補を、良い順で返す（純関数・シード任意）。 */
  suggestNext(progression: ChordEvent[], key: MajorKey, opts: SuggestOptions): ProgressionSuggestion[];
}
export interface SuggestOptions { allowPro: boolean; maxResults: number; seed?: number; }
```

### 2.2 ボイシングルール（VoicingAesthetic）

**一般則**

- 転回形と共通音保持で「最小移動」に。トップ声部（メロディ）の動きは滑らかに。
- レジスタは中音域中心（濁り回避）。ベースは body より 1 オクターブ下。
- Pro 品質: rootless/open ボイシング、テンションの上方配置、避音（♮11 over major3rd 等）の回避。

**実装写像（既に大半あり）**

- `voiceLeading.ts`（転回×オクターブ列挙→コスト最小）＋ `voicingColor.ts`（rootless/open）＋ 本スプリントで追加した **`VOICING_AESTHETICS`（balanced/warmLow/brightOpen）** と `voicingAestheticFor(feel)`。
- 追加提案: Pro 専用の `voicingColor` プロファイル（テンション上積み・open voicing 強め）を **VoicingAestheticId に `proOpen` を足す**形で拡張（既定は現行維持で回帰なし）。

### 2.3 リズム／グルーヴ（GrooveTemplate / Feel）

**一般則**

- グルーヴ = ステップ確率骨格 + アクセント + マイクロタイミング + スイング + 食い。
- バックビート強調、ハイハットのゴースト、キックとベースのロック。
- 「音を抜く」ことでグルーヴが生まれる（休符・bassOnly）。

**実装写像（既にほぼ完成）**

- `StylePreset`（hits/accent/gate/microtiming/velocity/anticipation/swing/**strum**）＋ `VariationProfile`（rests/ties/twoFourBar/phraseFill/bassOnly）＋ `feel/*`（natural/driving/relaxed）＋ `lockToGroove`。
- 本スプリントで **strum（ロール）** を追加済み。追加の伸びしろは §8 の「humanize 強度のティア化」。

### 2.4 ベースライン／オクターブ配置（BassStrategy）

**一般則**

- ルート弾き / ルート+5度 / 経過音（walking）/ 逆循環。オクターブは低すぎない（iPhone スピーカーで痩せない C2 中心、C1 は濁り）。
- スラッシュ（オンコード）でベースが動くと進行が滑らかに。

**実装写像**

- 現状 `naturalBank` が walking/sparse/dense を rotation。オクターブは `octaveShift`（C2⇔C3）で統一済み。
- 追加提案: `BassStrategy` を Strategy 化し、進行の機能から**経過音を挿入**する `walkingBass`（Pro）を候補に（既定は現行 rotation を維持）。

```ts
// 提案（新規 src/lib/performance/bass/BassStrategy.ts）
export interface BassStrategy {
  readonly id: string;
  /** 小節内のベース音列（degree/MIDI）を返す。既定は現行 rotation と一致。 */
  notesForBar(ctx: BassContext): number[];
}
```

### 2.5 メロディ生成（MelodyStrategy）※新規領域

**一般則**

- コードトーン（1/3/5/7）を骨、テンション/経過音を肉に。
- フレーズは「跳躍後は順次で戻る」「休符で呼吸」「小節頭・裏拍のアクセント」。
- コール&レスポンス、2/4 小節の反復と変化。

**実装写像（提案）**

- 現状は `top` 声部（highest / third）だけ。これを一般化し、コードトーン＋スケール音から**モチーフ**を選ぶ `MelodyStrategy` を追加。まずは "singable top line"（トップ声部の拡張）から。フル自動メロディは Pro の将来機能。

```ts
// 提案（新規 src/lib/performance/melody/MelodyStrategy.ts）
export interface MelodyStrategy {
  readonly id: string;
  /** 進行に沿ったメロディ NoteDraft 相当を返す（コードトーン優先・跳躍/順次バランス）。 */
  generate(ctx: MelodyContext): MelodyNote[];
}
export interface MelodyNote { midi: number; startBeat: number; durationBeats: number; velocity01: number; }
```

---

## 3. ワンタップ“気持ちいい”を保証する不変条件（UX 契約）

音楽理論を意識させないため、**どのワンタップ操作でも破綻しない不変条件**を守る:

1. **可聴性**: 各コード窓に必ずハーモニーが鳴る（既存 `ensureChordAudible`）。
2. **滑らかさ**: 隣接和音の平均声部移動 ≤ 4 半音（既存 voiceLeading 指標）。
3. **レジスタ**: body は中音域 [floor, ceil] に収まる（VOICING_AESTHETICS）。
4. **機械っぽさ回避**: 5 連続同一ベロシティ禁止、strum・microtiming で人間味（既存）。
5. **決定論**: 同じ seed は同じ結果（既存）。

「ワンタップ」= プリセット/候補を選ぶ → 上記契約を満たす `ResolvedProfile` で即再生。

---

## 4. TypeScript クラス設計（インターフェース）

```ts
// ── 抽出・蓄積の中核（新規 src/lib/theory/aesthetics/*.ts） ──

/** §1 図の AestheticProfile（[aesthetic-profile.md] のスキーマを型として実体化）。 */
export interface AestheticProfile {
  id: string;
  displayName: string;
  provenance: Provenance;                 // 出典（コピーでなく抽出元の記録）
  templates: StylePreset[];               // 既存型を再利用（重複型を作らない）
  variation: VariationProfile;            // 既存型
  humanizeScale: number;                  // micro-humanize 窓倍率
  voicing: VoiceLeadingOptions;           // 既存型
  tier: Tier;                             // 'free' | 'pro' （§8）
}

export interface Provenance {
  source: string;                         // 'midi:GoodSong10' | 'curated:jpop' | ...
  version: number;                        // 追記・改訂の履歴管理
  note?: string;                          // 「一般則の抽出」明記
}

export type Tier = 'free' | 'pro';

/** 供給側（後から幾らでも足せる拡張点）。 */
export interface MusicalitySource {
  readonly id: string;
  load(): Promise<AestheticProfile[]> | AestheticProfile[];
}

/** 蓄積。複数 Source の profile を id で束ね、provenance/version で管理。 */
export interface AestheticProfileRegistry {
  register(source: MusicalitySource): Promise<void>;
  all(): AestheticProfile[];
  byFeel(feel: AccompanimentPattern): AestheticProfile[];
}

/** feel + tier + tempo → 生成に使う 1 つのプロファイルに解決/ブレンド。 */
export interface ProfileResolver {
  resolve(input: ResolveInput): ResolvedProfile;
}
export interface ResolveInput {
  feel: AccompanimentPattern;
  tier: Tier;                             // 無料/有料でヒューマナイズ強度を変える（§8）
  tempoBpm: number;
  seed: number;
}
export interface ResolvedProfile {
  style: StylePreset;
  variation?: VariationProfile;
  humanizeScale: number;
  voicing: VoiceLeadingOptions;
}
```

**責務分離**: Source=供給、Registry=蓄積、Resolver=選択/ブレンド、各 Strategy=ドメイン生成、Engine=合成。どれも 1 責務・純関数中心。

---

## 5. パラメータ設計（要点表）

| 対象 | パラメータ | 型/範囲 | 既定（無料） | 有料での変化 |
|---|---|---|---|---|
| ヒューマナイズ | `humanizeScale` | 0.6–1.2 | 0.7（控えめ） | 1.0（豊か） |
| マイクロタイミング | `microtiming[track]` | MsRange | 狭い | 広い（人間味） |
| ストラム | `strum.spreadMs` | 8–18ms | 0 or 弱 | 12–16ms |
| ベロシティ | `VelocitySpec.accentDepth/phraseDepth` | 0..1 | 小 | 大（抑揚） |
| ボイシング | `VoiceLeadingOptions`（VOICING_AESTHETICS） | balanced | balanced | proOpen |
| コード候補 | `SuggestOptions.allowPro` | bool | false（基本コードのみ） | true（テンション/借用） |
| 変化 | `VariationProfile.*`（CappedRule） | prob+cap | 低 | 中（フィル/抜き） |

要点: **無料でも破綻しない**が、有料は「抑揚・タイミングの豊かさ・ボイシングの色・候補の広さ」でクオリティが一段上がる。数値は data で調整（ロジック非依存）。

---

## 6. アルゴリズム & 擬似コード（主要 3 つ）

### 6.1 プロファイル解決＆ブレンド（複数 Source の蓄積を活かす）

```text
resolve(feel, tier, tempo, seed):
  candidates = registry.byFeel(feel).filter(p => tier=='pro' || p.tier=='free')
  if candidates.empty: candidates = [DEFAULT_PROFILE_FOR(feel)]   # 常に成立（契約1,5）
  # 決定論的に主プロファイルを選択（seed 由来。複数 MIDI/チャンネルが蓄積されても再現）
  primary = pickDeterministic(candidates, seed, feel)
  style = lockToGroove(primary.templates[0], grooveProfile, tempo)
  # tier によりヒューマナイズ窓を薄く/濃く（§8 の核）
  humanize = primary.humanizeScale * (tier=='pro' ? 1.0 : FREE_HUMANIZE_DAMP)
  voicing  = tier=='pro' ? VOICING_AESTHETICS.proOpen ?? primary.voicing : primary.voicing
  return { style, variation: primary.variation, humanizeScale: humanize, voicing }
```

> ブレンド拡張: 将来は `pickDeterministic` を**加重合成**（複数 profile の hits/accent を確率平均）に差し替え可能。インターフェースは不変。

### 6.2 コード進行サジェスト（機能和声）

```text
suggestNext(progression, key, opts):
  last = functionOf(progression.last)            # T/SD/D
  cands = []
  for template in FUNCTION_TEMPLATES:            # 例: T→SD→D→T, ii→V→I, 4536…
     nextFn = template.after(last)
     for degree in diatonicDegreesWithFunction(nextFn, key):
        cands.push({chord: degree, reason:'functional', score: baseScore})
     if opts.allowPro:                           # 有料: 借用/セカンダリドミナント
        cands.push(...secondaryDominantsTo(nextFn), ...modalInterchange(key))
  cands += cadenceCandidates(progression)        # 終止感
  return sortByScoreDeterministic(cands).slice(0, opts.maxResults)
```

### 6.3 ヒューマナイズ（有料の核・既存パイプラインの強度制御）

```text
renderTrack(track, drafts, style, tier, seed, bpm):
  scale = tempoTimingScale(bpm) * resolved.humanizeScale   # tier で 0.7 or 1.0
  for d in drafts:
     t = grid + msToBeat(trackOffsetMs(seed,…,scale)) + swing + strum(d, style, bpm, seed)  # 既存
     v = humanizeVelocity(style, tier, seed)                # tier で抑揚幅
     …  # gate/articulation は既存
```

> 既存 `PerformanceEngine.renderTrack` は既に scale を受ける。**tier→scale の写像**を足すだけで「無料=素直／有料=豊か」を実現でき、破壊的変更を避けられる。

---

## 7. 拡張可能アーキテクチャ（チェーン蓄積）

「チャンネル/MIDI を後から追加してチェーンを蓄積」を最小コストで満たす:

1. **追加 = ファイル追加**: 新しい参照は `MusicalitySource` 実装を 1 つ追加し、起動時に `registry.register(source)` するだけ。既存コードは無改修。
   - 例: `MidiAnalysisSource(analysisJson)` → `extractAestheticProfile()`（[aesthetic-profile.md] のシグネチャ）→ `AestheticProfile[]`。
2. **provenance/version**: 各 profile に出典と版を持たせ、改訂・重複を管理（コピーでなく抽出の記録）。
3. **feel でインデックス**: `registry.byFeel(feel)` で解決対象を高速に取り出す。
4. **合成戦略の差し替え**: `ProfileResolver` を pickDeterministic → weightedBlend に差し替え可能（IF 不変）。
5. **決定論の維持**: 蓄積が増えても seed 由来の選択で再現性を担保。

これにより「1 本目の MIDI」も「10 本目のチャンネル由来傾向」も**同じ経路**で足せる。

---

## 8. 課金設計（Slack 反映: “便利”でなく“プロっぽい”に課金）

**思想**: ユーザーは Add9 が欲しいから払うのではなく、**ワンタップで「お、プロっぽい」**から払う。境界は「作品のクオリティが一段上がる部分」。

| 領域 | 無料（作る楽しさ） | 有料（クオリティが一段上） |
|---|---|---|
| コード | 基本コード＋定番進行 | テンション・ディミニッシュ・借用・セカンダリドミナント |
| ボイシング | 基本ボイシング（balanced） | プロ品質ボイシング（proOpen: rootless/open/テンション上積み） |
| **ヒューマナイズ（核）** | 控えめ（`humanizeScale≈0.7`、strum 弱、抑揚小） | **豊か**（`humanizeScale≈1.0`、strum 12–16ms、抑揚大、微タイミング広） |
| 変化/フィル | 低頻度 | 中頻度（phraseFill/抜き） |
| 試聴/引用 | 有料要素は**試聴のみ**（既存方針） | 引用・編集・書き出し可 |
| ウォーターマーク | 常時（除去不可・既存方針） | 常時（除去不可） |

**実装の要**: 課金は**パラメータ強度の 1 本のダイヤル（tier）**に集約する。tier → (`humanizeScale`, `VelocitySpec` 抑揚, `strum`, `VOICING_AESTHETICS`, `SuggestOptions.allowPro`) の写像を `ProfileResolver` に閉じ込める。UI/課金判定は既存 `billingService`/entitlement を Service 経由で参照（画面直書き禁止）。これにより「無料でも良い音」「有料で明確に上」を data で調整でき、ロジックは不変。

---

## 9. 段階的導入計画（承認後のスプリント案）

- **S1（低リスク・回帰なし）**: `Tier` と `ProfileResolver` を導入し、既存 feel 解決を包む。無料=現行相当、有料=`humanizeScale`/`strum`/抑揚を一段上げるだけ。UI は entitlement 経由。
- **S2**: `VOICING_AESTHETICS.proOpen` 追加（既定不変）。有料でボイシングの色を付与。
- **S3**: `ProgressionStrategy`（サジェスト）＋ UI の「続き候補」ワンタップ。無料=基本/定番、有料=テンション/借用。
- **S4**: `MusicalitySource`/`Registry` を実体化し `extractAestheticProfile` を実装（複数 MIDI 蓄積）。
- **S5（将来）**: `BassStrategy.walkingBass` / `MelodyStrategy`（歌えるトップライン→自動メロディ）。

各スプリントは「既定パス不変で全既存テスト緑」を絶対条件にし、新規テスト（tier 強度・サジェスト妥当性・レジスタ範囲・決定論）を足す。ネイティブ変更・EAS リビルドは原則不要（音色追加時のみ別途）。

---

## 10. 検証方針

- `npx tsc --noEmit` / `npx eslint`（変更ファイル）/ `npx jest`。
- 契約テスト: 可聴性・平均声部移動 ≤4・レジスタ範囲・5 連続同一ベロシティ禁止・決定論。
- 課金テスト: 無料 tier は現行出力に一致（回帰なし）、有料 tier は humanize 指標（タイミング分散・ベロシティ分散・strum spread）が有意に増える（範囲アサート）。
- サジェストテスト: 機能和声の妥当性（T/SD/D 遷移）、無料は基本のみ・有料はテンションを含む。
```
