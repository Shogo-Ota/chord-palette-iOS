# 教師データ監査後の次工程計画（Phase A–D 調査結果）

- 作成日: 2026-08-03
- 状態: **調査・分類案・仕様。GMD 取得・MIDI 生成・エンジン値変更・アプリ統合は未実施。**
- 前提（監査で確定）:
  - Reference Songs: 曲名・アーティスト・スタイル分類のみ登録済み（約74曲）
  - Measured Performance Data: **ゼロ**（MIDI Registry 空、曲別伴奏分析も 0 件）
  - Engine Design Values: Engine Spec と一部実装は作業仮説／設計値
  - 聴取の観点（結果ではない）: `docs/style_datasets/listening_analysis_guide.md`
  - 1曲フォーマット: `docs/style_datasets/song_analysis_template.md`
  - 正規購入 MIDI 分析の準備（曲分析は未実施）: `docs/song_analysis/`

## データ三区分（今後の記述ルール）

| 区分 | 意味 | 現状の例 |
|---|---|---|
| **Reference Songs** | 方向性を定義する参考曲 | `docs/style_datasets/*_teacher.md` の曲目 |
| **Measured Performance Data** | MIDI/音声から実測した統計・相対パターン | （なし）将来: GMD 統計、自作 Ballad MIDI |
| **Engine Design Values** | Chord Palette 用に設計・調整した値 | `relaxed` microtiming、`BALLAD_WARM`、仕様 H 表の数値案 |

Reference Songs を Measured として扱わない。MEASURED ラベルは実測があるまで使わない。

値のラベル定義:

| ラベル | 意味 |
|---|---|
| `MEASURED` | 実データから測定済み（現状 **全スタイル 0 件**） |
| `DESIGN_TARGET` | Chord Palette 用の設計値（実装済み or 実装予定のターゲット） |
| `HYPOTHESIS` | 未検証の仮説（一般知識・教材キーワードからの推測を含む） |
| `UNKNOWN` | 現時点では不明 |

---

## 1. Phase A — Engine Spec の誤認リスク表現と分類案

### 1.1 修正対象（5 仕様共通パターン）

以下は **MEASURED ではない**。現状ラベルは文書内で「仮説」と付いているが、「教師N曲の傾向」が実測風に読める。

| ファイル | 該当表現（要約） | 推奨ラベル | 修正案 |
|---|---|---|---|
| `ballad_engine_spec.md` §2 | 「教師18曲（First Love…）の**傾向として**」＋ H1 BPM 60–90 等 | HYPOTHESIS（BPM 数値は DESIGN_TARGET 候補としてもよいが未検証） | 「Ballad Engine の初期設計ターゲットとして 60–90 BPM を想定する。これは教師曲を計測した値ではなく、一般的な音楽知識に基づく未検証の設計仮説（HYPOTHESIS）である。Reference Songs の曲名は方向性の参照であり、傾向の根拠データではない。」 |
| `band_engine_spec.md` §2 | 「教師8曲の傾向として」＋ BPM 85–140 等 | 同上 | 同上形式で Band 向けに置換 |
| `city_engine_spec.md` §2 | 「教師18曲の傾向としての作業仮説」＋ BPM 95–120 等 | 同上 | 同上 |
| `dance_engine_spec.md` §2 | 「教師15曲の傾向」＋ BPM 110–130 等 | 同上 | 同上 |
| `rnb_engine_spec.md` §2 | 「教師15曲の傾向」＋ BPM 65–95・後ノリ数十 ms 等 | 同上（ms は特に DESIGN_TARGET / HYPOTHESIS と明記） | 「数十 ms」を曲の実測と誤認されないよう「設計仮説のレイト量目安（HYPOTHESIS、未計測）」と書く |

### 1.2 実装済み数値の分類（Ballad / Band / City）

これらはコード上存在するが **教師曲の MEASURED ではない**。

| 値の例 | 場所 | 分類 |
|---|---|---|
| Ballad microtiming chord `{2,12}` ms、gate legato、velocity center 66 等 | `styles/ballad.ts` / feel templates / calibration tests | **DESIGN_TARGET**（実装済み設計値） |
| `BALLAD_WARM`、`BAND_LINE`、`CITY_LINE` | `bass/profiles.ts` | **DESIGN_TARGET** |
| EIGHT_VARIATION phraseFill、accentDepth 38 等 | `variations.ts` / `eightBeat.ts` | **DESIGN_TARGET** |
| City chord microtiming ±3 ms、humanize 3–5 | `sixteenBeat.ts` | **DESIGN_TARGET** |
| 仕様 H1〜H10 の楽器編成・セクション話 | 各 engine_spec §2 | **HYPOTHESIS** |
| 曲ごとのボイシング・キック配置・後ノリ ms | — | **UNKNOWN**（MEASURED なし） |

### 1.3 各仕様への推奨追記（承認後に実施）

各 `docs/engine_specs/*_engine_spec.md` 冒頭または §2 直前に次の表を追加する案:

```markdown
## 値の分類（監査後）
| 記述 | 分類 |
| MEASURED | なし（2026-08-03 時点） |
| DESIGN_TARGET | §7–9 および実装済みプロファイル数値 |
| HYPOTHESIS | §2 H1–H10（Reference Songs 未計測） |
| UNKNOWN | 曲単位の具体演奏 |
```

**本フェーズでは Engine Spec 本文の一括置換は未実施**（分類案の承認後に実施する）。

---

## 2. Phase B — Humanize データ取得方針（調査結論）

### 2.1 パート分離

| パート | 初期データ源 | 禁止 |
|---|---|---|
| **Drums** | Groove MIDI Dataset（GMD）→ 統計的 Humanize Profile のみ | 元 MIDI フレーズのアプリ収録 |
| **Piano / E.Piano** | Chord Palette 用**独自演奏 MIDI**（`ballad_performance_midi_spec.md`） | 市販曲 MIDI の初期収集 |
| **Bass** | 独自演奏または明確許諾 MIDI の登録構造のみ準備 | ドラムデータからのベース Humanize 推定 |

### 2.2 GMD 導入に使える既存構造

| 既存資産 | パス | 役割 |
|---|---|---|
| SMF パーサ | `src/lib/performance/library/ingest/smf.ts` | Note / Tempo / TimeSig（**CC64・ドラムマップ未対応**） |
| 権利台帳 | `registry.ts` + `midi_registry.json` | verified + derivative のみ ingest |
| 相対化 | `relativize.ts` | コードトーン相対 → `LibraryPattern`（ドラム統計には不向き） |
| メトリクス | `analysis/metrics.ts` | velocity / timing deviation（グリッド相対、エンジン出力向け） |
| ポリシー | `docs/midi_dataset_policy.md` / `midi_sources.md` | 合法取得・非収録原則 |

**欠けているもの（GMD 最小構成で追加が必要な層）**:

1. `assets_dev/gmd/`（gitignore 済み方針。ダウンロードは別フェーズ）
2. GMD 専用台帳エントリ or `sourceName: "Groove MIDI Dataset"` の RightsRecord テンプレ
3. **ドラム統計抽出モジュール**（新規・ドメイン層）: キック/スネア/ハットの onset 偏差、velocity 分布、ゴースト閾値、フィル位置候補、テンポビン別 humanize 量 → JSON Profile（元 MIDI 非同梱）
4. SMF の GM ドラムチャンネル（ch10）解釈の拡張
5. アプリ統合は **しない**（本計画の範囲外）

GMD ライセンス（Magdalena Fuentes et al. / 公開データセット条項）は取得フェーズで `rights` に全文確認結果を記録する。**今はダウンロードしない。**

### 2.3 Piano 独自 MIDI

収録仕様: `docs/data_collection/ballad_performance_midi_spec.md`（作成済み）。  
登録は既存 `midi_registry` + ingest。CC64 解析は将来拡張。

### 2.4 Bass

Registry に `instrumentRole: 'bass'` を載せられる構造は**既にある**。  
初期はエントリ 0 のまま。ドラム→ベース推定ロジックは追加しない。

---

## 3. Phase C — Ballad 最小教材セット

→ **`docs/data_collection/ballad_performance_midi_spec.md`** に定義済み。

要約: 進行 4 種 × BPM 70/90/110 × パターン 6 種 × 2–3 テイク。初回は 24 ファイル縮小セット可。MIDI 本体は未作成。

---

## 4. Phase D — Baseline 調査結果

### 4.1 現在できること（コード確認済み）

| 機能 | 方法 | 出力 |
|---|---|---|
| 伴奏品質レポート | `ACCOMPANIMENT_REPORT=docs/performance/reports/<name>.json npx jest accompanimentReport` | 4 進行 × 全リズムの metrics JSON |
| メトリクス内容 | `computeMetrics` | noteCount、velocity mean/std、duration mean、pitch min/max、timing deviation、maxPolyphony、nonChordTone、invalidNote |
| 既存レポート例 | `docs/performance/reports/final-v1.01.json` 等 | 過去比較用 |
| 固定進行 A | `EVAL_PROGRESSIONS` A = C–G–Am–F（ただし **既定 BPM 120**） | `analysis/fixtures.ts` |
| 決定論 | 同一 seed で同一 NoteEvent | `REPORT_SEED = 20260802` |
| 整合性 | `invalidNoteCount` / midiIntegrity テスト | Note 長・velocity 範囲 |

### 4.2 指示の固定条件とのギャップ

指示: **C–G–Am–F / 4/4 / 90 BPM / Ballad / Piano**

| 条件 | 現状 | ギャップ |
|---|---|---|
| 進行 C–G–Am–F | 進行 A あり | なし |
| 4/4 | `relaxed` は 4/4 | なし |
| 90 BPM | 進行 A は **120**、進行 D は 90 だが進行が違う | **要追加**: 90 BPM の A、または Baseline 専用フィクスチャ |
| Ballad | リズム id `relaxed`（スタイルカードの Ballad） | レポートは全リズム一括。Ballad 単独スライスは手動フィルタ可 |
| Piano | エンジンは音色非依存の NoteEvent（音色は再生層） | Baseline の「Piano」は再生/書き出し時の指定。イベント JSON には楽器なし |
| イベント JSON | レポートは **metrics のみ**（NoteEvent 配列は保存しない） | **要追加** |
| MIDI 書き出し | **なし**（SMF は read only） | **要追加**（任意） |
| 音声 | アプリ再生のみ。ヘッドレス書き出しなし | 実機録音 or 将来のオフラインレンダ（優先度低） |
| Sustain | エンジン NoteEvent にペダルなし | Baseline では N/A |

### 4.3 追加が必要な Baseline 機能（実装は次工程・承認後）

変更候補（**未実装。承認前に対象を明示**）:

| 追加物 | 候補パス | 理由 |
|---|---|---|
| Ballad@90 固定 Baseline ジェネレータ | 新規 `src/lib/performance/analysis/balladBaseline.ts` + `__tests__/balladBaseline.test.ts` | 指示条件で NoteEvent + metrics を 1 ファイルに保存 |
| 出力先 | `docs/performance/baselines/ballad_C-G-Am-F_90bpm_relaxed_<date>.json` | 実データ導入後の比較用 |
| （任意）SMF ライター | `library/ingest/smfWrite.ts` | DAW 目視比較用。必須ではない |
| 進行 A @ 90 | fixtures 拡張 or Baseline 内オーバーライド | 既存進行 A の BPM を壊さず Baseline だけ 90 にする |

既存 `accompanimentReport` を壊さないこと（他リズムの回帰比較に使用中）。

---

## 5. GMD 解析ツールの最小構成（設計のみ）

```text
assets_dev/gmd/                    # gitignore・未ダウンロード
docs/style_datasets/gmd_registry.json  # または midi_registry に dataset エントリ
src/lib/performance/humanize/
  gmdTypes.ts                      # Profile 型（MEASURED 統計）
  gmdStats.ts                      # SMF → 統計（純関数）
  __tests__/gmdStats.test.ts       # フィクスチャ数小節のみ
scripts/ または jest ジェネレータ     # GMD_STATS=1 で Profile JSON 出力
docs/performance/humanize/gmd_profile_v0.json  # 統計のみコミット可
```

**やらない**: アプリへの Profile 読み込み、ドラムパターン差し替え、元 MIDI の repo 投入。

---

## 6. MIDI Registry へ必要な追加項目

現行 `MidiRegistryEntry` / `PatternAnnotation` / `RightsRecord` で自作 Ballad の大半は足りる。追加推奨（スキーマ拡張・承認後）:

| フィールド | 理由 |
|---|---|
| `annotation.patternType` | `block` / `arp_slow` 等（tags でも可だが第一級が望ましい） |
| `annotation.performanceTake` | テイク番号 |
| `annotation.progressionId` | P1–P4 |
| `annotation.hands` | `split` \| `single` |
| `annotation.pedalUsed` | boolean（CC64 有無） |
| `rights.datasetName` | GMD 等データセット名の明示（sourceName と分離可） |
| `dataClass` | `reference_song_meta` \| `measured_midi` \| `design_only`（台帳エントリの種別） |
| `performer` | 演奏者（rights.notes でも可） |

GMD 用は `instrumentRole: 'drums'`、`sourceType: 'licensed'` or データセット方針に合わせた値、`derivativeUseAllowed` はライセンス確認後に設定。

---

## 7. 次の実装順序（承認後）

1. **Engine Spec 文言修正**（Phase A）— 「傾向」表現の置換 + 値分類表の追記（ドキュメントのみ）
2. **Ballad Baseline ジェネレータ**（Phase D）— C–G–Am–F / 90 / relaxed の NoteEvent+metrics JSON 保存
3. **Registry スキーマ拡張**（patternType / take / progressionId 等）+ ポリシー文書更新
4. **ユーザー収録**（Phase C）— 仕様に従い最小 24 テイク（エージェントは MIDI を作らない）
5. **自作 MIDI を台帳登録 → ingest** — Measured の LibraryPattern / レポート
6. **GMD ライセンス確認 → ダウンロード → 統計 Profile 生成**（Phase B Drums）— アプリ未接続
7. Baseline vs Measured の差分レポート（数値比較）
8. （その後）Engine Design Values の再キャリブレーション案 — **勝手に値を変えず提案のみ**
9. Humanize Profile のアプリ統合はさらに後

---

## 8. ユーザー側で用意する必要があるもの

| 項目 | 用途 |
|---|---|
| MIDI キーボード or DAW + ピアノ音源 | Ballad 独自演奏収録 |
| 演奏者（オーナー自身で可） | オリジナル伴奏の権利明確化 |
| 収録仕様の承認 | `ballad_performance_midi_spec.md` |
| Phase A 文言修正の承認 | Engine Spec 一括更新の実行許可 |
| Baseline ジェネレータ実装の承認 | 対象ファイルへのコード追加許可 |
| （後続）GMD 利用許諾の確認結果 | 台帳 `rights` 記入 |
| （任意）許諾済みベース MIDI or 自作ベーステイク | Bass Measured（ドラムから推定しない） |

---

## 9. 今回実施したこと / しなかったこと

**実施**
- Engine Spec の誤認リスク洗い出しと分類案（本文一括修正は保留）
- Ballad 演奏 MIDI 収録仕様の作成
- Baseline 現状調査とギャップ整理
- GMD 最小構成の設計調査
- Registry 追加項目案と実装順序

**未実施（指示どおり）**
- GMD ダウンロード
- 市販 / 新規 MIDI 生成
- 既存エンジン値の変更
- iOS への Humanize Profile 統合
- 教師曲の演奏内容の推測追加
