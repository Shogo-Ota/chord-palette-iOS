# Sprint 6 — 音質・音楽的魅力の向上（Music Quality）実装カード

正典: `Chord_Palette_iOS_MVP_Requirements_v1.md`（特に §5.5 ボイスリーディング / §5.6 音楽ロジック / §5.7 音色 / §11 P1「コードボイシングの改善」 / §12 音質・性能）＋ 音源設計書 `docs/design/natural-performance-engine.md`（§4 Performance Engine / §6 品質ゲート）＋ 音楽監修 `docs/music-supervisor-audit.md` ＋ 本カード。
前提: M1 オーディオ（伴奏4パターン block/eightBeat/sixteenthBeat/arpeggio ＋ドラム7グルーヴ pop8/pop16/rock8/rock16/soul16/jazzSwing/bossaNova ＋度数対応テンション＋コード低音2オクターブ）は `master` に統合・実機で再生確認済み。

> **着手タイミング（厳守）**: 本スプリントは **M3（Sprint 5A / 課金 Mock 先行）が `@evaluator` 合格した後に着手**する（パイプライン順序: sprint-5 → sprint-6）。
> **アーキテクチャ方針（2026-07-18 ユーザー決定 / 重要）**: 音源設計書は「Web/PWA 先行・Tone.js」前提だが、**本プロジェクトでは Web 化はしない**。設計書の**中核思想（演奏生成を `NoteEvent` として音源から分離する）と §4 演奏スペックのみをドメイン層に採用**し、**現行 iOS ネイティブ基盤（Expo + Swift `AudioEngineController` + SoundFont / `chord-audio`）は Renderer として維持・段階接続**する（Web/Tone.js は将来の Renderer アダプタ候補）。詳細は §4「Performance Engine 実装設計」。
> 本スプリントは「コアスペック＝音の良さ」を引き上げる**品質スプリント**。要件の新機能追加ではなく、**既存の音（ボイシング / 伴奏 / ドラム / テンション / プリセット）の魅力向上**が対象。優先度は P1（§11）だが、アプリの中核価値であり、かつ **voice-leading は要件 §5.5 の未達解消（P0）** を兼ねるため 7/31 リリース前に可能な範囲で反映する。
> 変更は主に **ドメイン層（`src/lib/`・純ロジック・RN/Expo 非依存・単体テスト可）** と **Swift ネイティブ（`modules/chord-audio`）**。Step 1（voice-leading をドメインに載せる）は**ネイティブ再ビルド不要な範囲**から着手し、ネイティブ変更を伴う Step 2/3 は **EAS 再ビルド必須**（TS のみの変更は Metro 反映）。

---

## 0. 確定した方針

- **層分離を維持**: 音楽ロジック（ボイシング / スケール判定 / 度数 / 演奏生成）は**ドメイン層（JS/TS・純粋）** に集約し、Swift は「発音プラン／`NoteEvent`」を受け取って発音・合成に専念する（Sprint 4 の設計思想を踏襲）。ドメインは RN/Expo 非依存で単体テスト可能に保つ。
- **音源設計書の中核思想を採用（Web 化はしない）**: 演奏生成を `NoteEvent` として音源から分離し、`voiceLeading → velocity → microtiming → articulation → seed` を**ドメイン層 `src/lib/performance/`（新規）** に置く。現行 iOS ネイティブは **Renderer** として維持し、段階接続する（§4）。
- **Renderer をインターフェース化（Strategy / Provider）**: Domain（Performance Engine）は Renderer に依存しない。現行 **iOS ネイティブ Renderer** と将来の **Web/Tone.js Renderer** を差し替え可能にする。`NoteEvent[]` が両者の共通契約（境界）となる。
- **既存の聴感方針を尊重**（M1 実装済み）: `block=拍頭固定・シンコペ無し・ベロシティほぼ均一` / `8・16beat=食い(look)＋微小タイミング揺らぎ＋ベロシティ波` / `arpeggio=現状維持`。本スプリントはこの土台を**壊さず磨く**。
- **音楽監修（Music Supervisor）の監査結果を正典として反映**する。監査は `docs/music-supervisor-audit.md`（2026-07-18 出力済み）にあり、**その P0/P1 と着手 TOP3 を本カード §3 に転記済み**。着手前に §2 の変更対象と突き合わせ、変更提案（4点セット）を提示して承認を得る。
- **音源はライセンス確認済みのもののみ**追加（Sprint 2B 方針）。未確認の音源・SoundFont をリポジトリに入れない。Pro 音色（アコギ/エレキ/ストリングス）は V2 送りのため本スプリント対象外。
- **拡張性重視**: 音の調整は `InstrumentProvider` / `DrumProvider` / ボイシング関数など**既存の差し替え点の内側**で行い、`AudioEngineController` / `Mixer` / `Scheduler` の骨格は不変に保つ（ripple 最小化）。パラメータ（humanize 量 / timingSway / velocity カーブ / ringCap 等）は定数として集約し、God クラス化を避ける。
- **性能退行を作らない**: 既知の観察点（リアルタイム経路の `chordSampleValue` 全 strike 線形走査、rock16×sixteenthBeat の音割れ）を悪化させない。むしろ音質改善のついでに顕在化すれば @generator へ最適化として組み込む。

---

## 1. スコープ境界（対象 / 対象外）

### 対象（音楽監修の監査結果に応じて取捨。§3 で確定）
- **コードボイシング改善**（§11 P1）: `src/lib/voicing.ts`（低音2オクターブ重ね C1+C2、`INTERVALS`、`CHORD_ROOT_MIDI=48` 固定）の見直し。転回・トップノート連結（voice leading）・低音の濁り回避など、音楽監修 P0/P1 の範囲で。
- **伴奏パターンの音楽性**: `AudioEngineController.swift` の `buildChordstrikes` / `humanize` / `timingSway` / `ringCap` / `emitGroup` / `emitGrid` のパラメータ調整（食い・揺らぎ・ベロシティ波・音の長さ）。
- **ドラムグルーヴの質感**: `DrumProvider.swift`（7グルーヴ合成ドラム）のキック/スネア/ハイハットの音作り・ベロシティ・スウィング率・ゴースト音などの調整。
- **テンション/度数の音楽的妥当性**: `src/data/music.ts`（`DEGREE_VARIATION_SUFFIX` / `availableVariations` / `variationChord`）の、度数ごとに理論的に成立するテンションの出し分け（Sprint 1 申し送りの「11th/13th のディグリー別可否」を含む検討）。
- **プリセットの進行としての魅力**: `src/data/presets.ts` の各進行の妥当性・転調時の破綻回避。

### 対象外（→ 後続 / V2）
- Pro 音色（Acoustic/Electric Guitar・Strings）の音源実装（→ V2）
- サンプルドラム（ワンショット）への全面移行（MVP は合成ドラムを磨いて出荷 / §release-plan §5-2）→ ライセンス確認済み素材が用意できた場合のみ限定的に検討
- 新規エフェクトチェーン（リバーブ/コンプ等）の大規模導入（音楽監修が P0 指定した最小限を除く）
- 課金・動画・分析・UI レイアウトの機能変更（他スプリント / designer 責務）
- 音楽エンジンの骨格（Scheduler / Mixer / セッション管理）の作り直し

---

## 2. 変更予定ファイル（音楽監修の監査結果で最終確定）

> 下記は想定範囲。実際の変更は §3 に転記される音楽監修 P0/P1 指摘に基づき、**着手前に「今から行うこと / 変更対象 / 技術的理由 / 期待結果」を提示して承認を得る**。

### 変更候補（既存改変は最小・理由明記）
- `src/lib/voicing.ts` — ボイシング（転回 / voice leading / 低音の重ね方）。純粋関数として単体テスト追加。
- `src/data/music.ts` — 度数別テンションの出し分け（`availableVariations` / `variationChord`）。
- `src/data/presets.ts` — プリセット進行の微修正（音楽監修指摘があれば）。
- `modules/chord-audio/ios/AudioEngineController.swift` — 伴奏の humanize / timingSway / ベロシティ波 / ringCap のパラメータ調整。
- `modules/chord-audio/ios/DrumProvider.swift` — 7グルーヴの音作り・スウィング・ゴースト音。
- （必要時）`modules/chord-audio/ios/SynthInstrumentProvider.swift` — 合成音のエンベロープ / 倍音の質感調整。

### 新規候補
- `src/lib/__tests__/voicing.test.ts`（ボイシング純粋ロジックの単体テスト。追加/拡充）
- （必要時）`modules/chord-audio/ios/` に音作りパラメータを集約する定数ファイル（God クラス回避のため）

### 必要ライブラリ
- 原則追加なし（既存エンジン内の調整）。ライセンス確認済み音源を追加する場合のみ、素材とライセンス表記を `docs/` に記録。

---

## 3. 音楽監修の指摘反映（`docs/music-supervisor-audit.md` からの転記）

> `docs/music-supervisor-audit.md`（2026-07-18 出力）の P0/P1 と「着手 TOP3」を以下に転記した。粒度（症状／音楽的理由／対象ファイル・関数・パラメータ／担当／実機検証方法）を保持している。P0/P1 を本スプリントの実装対象とし、P2 は §7 申し送りへ回す（audit §1「P2」参照）。
> **設計書 §4 との整合**: 音楽監修の P0-1（voice-leading）と音源設計書 §4「ボイシング」層は**同じ方向**。本カードでは重複を避け、**voice-leading を §4 Performance Engine の Step 1（最優先）に統合**し、P0-2/P1-1/P1-2/P1-4（低音・ドラム音色・sparkle）は §4 の velocity/microtiming/articulation 層および Renderer 側チューニングとして位置づける。以下 §3 は「音楽監修の症状ベースの指摘」、§4 は「設計書ベースの実装設計・受入基準」として読むこと（両者は同一の作業を別視点で記述）。
> 着手前に運用ルール（`workflow.mdc`）に従い「今から行うこと／変更対象／技術的理由／期待結果」を提示して承認を得ること。

### §3.1 P0（リリース前に必須で反映）

#### P0-1. コードにボイスリーディング（転回形選択）が無く、進行がブロック的に跳ねる
- **症状**: I→V→vi→IV のような基本進行でも各コードが毎回 C3 のルート・ポジションで鳴り、和音の"塊"が上下にジャンプして聞こえる。トップノートの旋律的連結が生まれず、ループ再生・動画書き出しで「打ち込み感／貼り付け感」が強く出る。
- **音楽的理由**: 鍵盤伴奏の自然さは「共通音の保持」と「最短距離の声部移動（トップノートが滑らかに動く）」で決まる。現状 `chordMidiNotes()` は前コードを一切参照せず、各和音を `CHORD_ROOT_MIDI = 48`（`voicing.ts` L14）からのルート・ポジションで独立生成しており声部連結が存在しない。**要件 §5.5「基本的なボイスリーディングを自動適用する」を満たしておらず DoD 未達**。
- **対象（ファイル/関数/パラメータ）**: `src/lib/voicing.ts` の `progressionToChordSpecs()`（L91）に「直前コードのボイシングを引き継いで次コードの転回形を選ぶ」パスを追加。アルゴリズム案: 各コード body 音（`suffix` の INTERVALS 展開）についてルート位置から ±1 オクターブの転回形候補を作り、**直前コードのトップノート（または各声部の重心）との合計移動距離が最小になる転回形を選ぶ**。目標レジスターは C3〜C4 付近にクランプ（レジスタードリフト防止）。ベース（`SUB_BASS_ROOT_MIDI`/`BASS_ROOT_MIDI` L16/L22）はルート（またはスラッシュ・ベース）固定のまま上物 body だけ転回。**新規 `src/lib/voiceLeading.ts` に転回選択関数を切り出し、`voicing.ts` からは呼ぶだけ**にする（拡張性ルール準拠・既存改変最小化）。
- **担当**: @generator（純ロジック／型定義・単体テスト付き）
- **実機検証方法**: 王道系 4 コード（C→G→Am→F）を Block と 8beat で再生。トップノートが半音〜数半音以内で滑らかに動くか、和音の"ジャンプ感"が消えたかを聴く。変更前後の書き出し MP4 を A/B。

#### P0-2. 低音2オクターブ重ね（C1）が実機スピーカーで濁り／無駄になる
- **症状**: 全コードで C1(MIDI 24)＋C2(MIDI 36) を常時重ねている（`voicing.ts` L85 `bass`）。ヘッドフォン／良いスピーカーでは"ブーミー"、iPhone 内蔵スピーカーでは C1(≈32.7Hz)〜C2(≈65Hz) がほぼ再生されずヘッドルームだけ食って中域が痩せる。8beat/16beat では毎拍この2音が鳴り、混変調で低域がモコつく。
- **音楽的理由**: ポップ／ピアノのローエンドは通常「1オクターブ（＋必要なら5度）」で十分。サブオクターブ・ダブリングは基音同士の唸り（beating）と位相打ち消しを招きやすい。モバイル主聴取環境（内蔵スピーカー）は ~150Hz 以下が出ないため、C1 は"音"でなく"濁りの種"になりがち。
- **対象（ファイル/関数/パラメータ）**: `src/lib/voicing.ts` L85 のサブベース C1 を**常時重ねから外す**か、少なくとも **gain を下げて重ねる**（現状 body と同ゲイン）。案: ベースは C2 主体、C1 は任意（内蔵スピーカー時無効／ヘッドフォン時のみ薄く）。もしくは `AudioEngineController.swift` の `emitGroup`（L643）で `isBass` 選択時に**サブベース側だけ gain を 0.5〜0.6 に減衰**（`baseVel` 計算箇所 L666 付近）。併せて Mixer 側（`buildEngine` L300-302 の `setChordVolume(0.85)`）とローエンドの兼ね合いを実機再チューニング。
- **担当**: @generator（`voicing.ts` のベース構成、または Swift の bass gain）
- **実機検証方法**: iPhone 内蔵スピーカーとイヤホン両方で、単一コード長押し試聴と 8beat ループを比較。「中域（コードの色）が痩せていないか」「低域がモコつかないか」を A/B。

### §3.2 P1（強く推奨・本スプリントで反映）

#### P1-1. 合成キックにアタック（クリック）が無く、内蔵スピーカーで芯が消える
- **症状**: `DrumProvider.swift` の `.kick`（L131-136）は 120→45Hz へ落ちる純サイン＋指数エンベロープのみ。良い再生環境では"ボスッ"と鳴るが、iPhone スピーカーでは低域が出ず**存在感がほぼ消え、リズムの芯が失われる**。
- **音楽的理由**: モバイルでキックを聞かせるには低域基音だけでなく**アタック成分（ビーターのクリック＝100〜4kHz の短い過渡音）**が不可欠。内蔵スピーカーは基音を再生できず、聴感上のキックは中高域クリックが担う。
- **対象（ファイル/関数/パラメータ）**: `voiceSample(.kick …)`（L131）に冒頭 3〜8ms の短いクリック（高めのサイン or 帯域ノイズを急速減衰）を加算。既存 `noise(frame)`（L175）を短エンベロープで流用可。基音ピッチ落とし（L135）はそのまま維持。
- **担当**: @generator（Swift 合成音）
- **実機検証方法**: pop8/rock8 を内蔵スピーカーで再生し、キックが「聞こえる／位置が分かる」か。ヘッドフォンで低域が過剰でないかも確認。

#### P1-2. 合成スネアが細く／硬い（帯域整形なし・中域の"鳴り"不足）
- **症状**: `.snare`（L137-143）は 180Hz サイン＋フルバンド白色ノイズ。低めのトーンとザラついた白色ノイズで"パン"という胴鳴りが薄く、グルーヴによって安っぽく／耳に痛く聞こえる。
- **音楽的理由**: スネアの芯は 150〜250Hz の胴鳴り＋帯域制限ノイズ（~2〜8kHz）で作られる。フルバンド白色ノイズは高域過剰でチープに、180Hz 固定トーンは胴鳴り密度が不足。
- **対象（ファイル/関数/パラメータ）**: `.snare` のトーンに 200Hz 前後の第2成分を足す／ノイズを簡易ハイパス（前サンプルとの差分で近似）してブライトすぎを抑える。エンベロープ（L140）は概ね良好。
- **担当**: @generator（Swift 合成音）
- **実機検証方法**: soul16/pop16 のバックビートでスネアが「詰まって聞こえる／耳に痛くない」か。ゴーストノート（soul16 の 1.75/3.75, L96）が潰れず聞こえるか。

#### P1-3. プリセット「王道進行」のラベルと度数が音楽通例と不一致
- **症状**: `src/data/presets.ts` の `jpop-royal`「J-POP王道進行」が **I-V-vi-IV**（C·G·Am·F, L20-26）で定義。一方 `city-pop`「City Pop進行」が **IVmaj7-V7-iiim7-vim7**（=4536, L96-102）。**「王道」ラベルが理論通例とズレ、かつ `pop-punk`（L66 が同一進行）と完全重複**している。実際の 4536 は `city-pop` 側にあるねじれ。
- **音楽的理由**: 日本語の「王道進行」は通例 **IV-V-iii-vi（4536, FM7-G7-Em7-Am7）**。現状の I-V-vi-IV は Axis/カノン系で `pop-punk` と被る。
- **対象（ファイル/関数/パラメータ）**: `src/data/presets.ts` のデータのみ修正。`jpop-royal` を本来の 4536（IVmaj7-V7-iiim7-vim7 相当、または三和音版 F-G-Em-Am）へ修正し `chordsDisplay`/`degreeLabel`/`chords` を更新。無料枠は §5.11 で「J-POP王道進行」指定のため**進行側を 4536 に直す**のが仕様適合。`pop-punk` との重複解消、`city-pop` と役割が被らないよう再整理（City Pop はテンション/オンコードで差別化）。※**法務リネーム（release-plan §5-3 / M5）と同時対応が効率的**。
- **担当**: @generator（`presets.ts` データ）
- **実機検証方法**: 各プリセット選択→再生し、4536 が"王道"らしい浮遊感で鳴るか、`pop-punk` と区別が付くかを聴く。

#### P1-4. 伴奏の「sparkle（トップ+1オクターブ複製）」が全打点で入り、機械的に響く
- **症状**: `AudioEngineController.swift` の `emitGroup`（L659-666）で `sparkle` 時にトップノート+12 を 0.5 ゲインで常時追加。Block は各コード頭（L799）、8beat は全ストローク（L718 `sparkle: true`）で発火し、"ベル／シンセ的"な人工感が出る。
- **音楽的理由**: 生ピアノは高音オクターブを機械的に毎回重ねない。ブライトネス付与は「頭拍だけ」「弱く」「たまに」が自然。全打点ダブリングは倍音過多で音像が硬い。
- **対象（ファイル/関数/パラメータ）**: `emitGrid`/`emitGroup` の `sparkle` を 8beat では**頭拍（beat 0/2）だけ**に限定、または gain を 0.5→0.3 程度へ低減。Block はコード頭のみで現状維持でも可だがゲイン再考の余地あり。
- **担当**: @generator（Swift 伴奏ロジック）
- **実機検証方法**: 8beat で高音の"チリチリ"したオクターブ重ねが目立たないか、ピアノらしい自然な明るさかを A/B。

### §3.3 着手 TOP3（音楽監修が指定）

音楽監修が「音楽的インパクト × 低リスク × 主聴取環境（iPhone スピーカー）への効き」で厳選（提出 7/25 前提）。

1. **P0-1 ボイスリーディング（転回形選択）の導入** — `src/lib/voicing.ts`（新規 `src/lib/voiceLeading.ts` 推奨）
   - 唯一の"根本的"な音楽品質底上げ。要件 §5.5 未達解消も兼ねる。純ロジック＝単体テスト可・ネイティブ再ビルド不要で Windows 開発でも検証が速く、全伴奏パターン・全プリセット・動画書き出しに一括で効く（**最大 ROI**）。
2. **P0-2＋P1-1 実機スピーカー向けローエンド／キック再チューニング** — `voicing.ts` L85（サブベース C1 重ね）＋ `DrumProvider.swift` `.kick`（L131 にアタック付与）
   - iPhone 内蔵スピーカーでの体感品質を**低工数**で大きく改善。「低音が濁る／キックが消える」は第一印象を損なう典型。ネイティブ再ビルドは要るが変更は局所的。
3. **P1-3 プリセット「王道進行(jpop-royal)」の理論修正（＋法務リネーム同時対応）** — `src/data/presets.ts`
   - **データ修正のみ・リスクほぼゼロ・工数最小**で、"王道が王道でない"問題と `pop-punk` との重複を一挙解消。M5 の法務リネームと同時対応で二度手間を防ぐ。

> 上記 P0/P1 を §2 の変更対象ファイルと突き合わせ、着手前の変更提案（4点セット）を提示して承認を得る。P2（ハット抑揚 / 開離ボイシング / プリセット拡充＝カノン進行等）は §7 申し送りへ。実装順序は audit §5（M3 と並行で P1-3 → M3 後〜M4 で P0-1 → 同 M4 で P0-2＋P1-1/P1-2 をネイティブ再ビルド1回に束ねる）を推奨。

---

## 4. Performance Engine 実装設計（音源設計書 §4 の反映）

> 出典: `docs/design/natural-performance-engine.md` §1・§4・§6。**Web 化はせず、設計書の「演奏生成を `NoteEvent` として音源から分離する」思想と §4 演奏スペックのみを採用**。現行 iOS ネイティブは Renderer として維持し段階接続する。§3 の音楽監修 P0-1（voice-leading）は本節 **Step 1** の中心。

### 4.1 レイヤ構成と責務境界（層分離）

設計書 §1 の処理フローを、本プロジェクトの層に割り付ける:

```
① Chord Input   Key / Chord / BPM              … 既存（editor / project データ）
② Voicing       転回・声部連結・音域            … ドメイン src/lib/voiceLeading.ts（新規・Step 1）
③ Performance   Style / Groove / Articulation   … ドメイン src/lib/performance/（新規・Step 2）
④ NoteEvent     beat・pitch・vel・dur・seed       … ドメインの出力契約（Renderer 境界）
⑤ Renderer      NoteEvent を発音                … iOS ネイティブ AudioEngineController（維持・Step 3）
                                                   ／将来: Web/Tone.js Renderer アダプタ
```

- **Domain（`src/lib/`）は RN/Expo・ネイティブ・Renderer に一切依存しない**（純ロジック・単体テスト可）。
- **Renderer は `NoteEvent[]` を受け取って発音するだけ**。演奏の意図（強弱・タイミング・奏法）は Domain が確定済み。
- **Domain は Renderer を知らない**（依存方向は Renderer → Domain の一方向）。

### 4.2 NoteEvent 契約（ドメイン出力・Renderer 入力の境界）

設計書 §1「NoteEvent 最小契約」をドメインの型として定義する（`src/lib/performance/NoteEvent.ts`・新規）。

```ts
export type Articulation = 'normal' | 'legato' | 'staccato' | 'tie' | 'pedal' | 'ghost';

/** 演奏生成の最小契約。Renderer（iOS ネイティブ / 将来 Web）はこれを解釈して発音する。 */
export interface NoteEvent {
  timeBeat: number;        // 進行先頭からの開始拍（共通タイムライン基準）
  durationBeat: number;    // 長さ（拍）。gate 反映後の実発音長
  pitch: number;           // MIDI ノート番号
  velocity: number;        // 0–127（アクセント×phraseカーブ×個体差を反映済み）
  articulation: Articulation;
  rrIndex: number;         // Round Robin 選択インデックス（同一 sample 連続回避）
  trackId: string;         // 例: 'chord' | 'bass' | 'kick' | 'snare' | 'hat'
  seed: number;            // 決定論的再現用（同 seed = 同演奏）
}
```

- **seed は進行（プロジェクト）に紐づけて保存**し、同じ進行が再生ごとに破綻せず再現される（設計書 §1・§6「同 seed 再現」）。
- **既存 `NoteEvent`（`modules/chord-audio` の `PlaybackRequest.chordEvents`）とは別物**。ドメインの `NoteEvent` は演奏意図を含む上位表現で、Renderer 接続時に既存ネイティブ入力へマッピングする（Step 3）。名前衝突を避けるため命名（例: `PerfNote` 等）は実装者判断でよいが、契約フィールドは上記を満たすこと。

### 4.3 Performance Engine の処理順（決定論パイプライン）

`src/lib/performance/`（新規）に、以下を**この順序**で適用する純関数群を置く。乱数は必ず seed 由来（`Math.random` 直呼び禁止）。

1. **voiceLeading**（Step 1 の中心 / audit P0-1）: 直前コードのボイシングを引き継ぎ、共通音保持・内声移動 ±7半音以内で転回形を選ぶ。トップノートとベース転回は別制御。
2. **velocity カーブ**: 拍アクセント × 2/4小節 phrase curve × 音ごとの個体差。通常揺らぎ MIDI ±4〜7、ghost 20〜45。
3. **microtiming**: 独立乱数を禁止し Style ごとに相関。Kick 基準、Bass ±4ms、Hat −6〜+4ms、Snare +4〜+14ms。**bar 境界で累積 drift = 0**。
4. **articulation / duration**: gate 0.72〜0.95、同音再打鍵前に 15〜35ms 空ける。Tie/Legato/Pedal、Strum は 8〜35ms で方向差。
5. **seed 適用（Round Robin）**: 各主要音域 × velocity 層で 3種類以上、同一 sample 連続回避を seed で決定論選択。

### 4.4 段階実装計画（Step 1 → 2 → 3）

| Step | 内容 | 層 | ネイティブ再ビルド | 主眼 |
|---|---|---|---|---|
| **Step 1** | **voice-leading をドメインに載せる**。新規 `src/lib/voiceLeading.ts`、既存 TS→chordSpecs 経路（`voicing.ts` `progressionToChordSpecs()`）に転回選択を差し込む。 | Domain のみ | **不要**（Metro 反映） | 最大 ROI・要件 §5.5 解消。audit P0-1 と同一。 |
| **Step 2** | **velocity / microtiming / articulation を `NoteEvent` 化**。`src/lib/performance/` に Performance Engine を実装し、進行→`NoteEvent[]` を生成。まずドメイン内で完結（純ロジック・単体テスト）。 | Domain のみ | **不要**（テストは JS） | 演奏スペック §4 の中核。Renderer 未接続でもテスト可能。 |
| **Step 3** | **Renderer 接続**。`NoteEvent[]` を iOS ネイティブ（`AudioEngineController`）の発音入力へマッピングし、実機で発音。低音再チューニング（audit P0-2）・キック/スネア音色（P1-1/P1-2）・sparkle 抑制（P1-4）も Renderer 側調整としてここで束ねる。 | Domain→Renderer 境界 ＋ Swift | **必要**（EAS） | ネイティブ再ビルドを1回に束ねる（audit §5 と整合）。 |

- **Step 1 は M3 合格後すぐ着手可能**（ネイティブ再ビルド不要でリリースリスク最小）。
- Step 2 は Renderer 未接続でも単体テストで受入判定できる（設計書 §5 Phase 2「Performance MVP」に相当）。
- Step 3 で初めてネイティブに触れる。EAS ビルド待ちを計画に織り込む。

### 4.5 Renderer 抽象化（Strategy / Provider）

```ts
/** 演奏（NoteEvent 列）を実際に発音する責務。Domain はこの抽象にのみ依存し、具象を知らない。 */
export interface PerformanceRenderer {
  prepare(): Promise<void>;
  render(notes: NoteEvent[], opts: { bpm: number; totalBeats: number; loop: boolean }): Promise<void>;
  stop(): Promise<void>;
}
```

- **`NativeAudioRenderer`（現行・維持）**: `chord-audio` の `AudioEngineController` を薄くラップし、`NoteEvent[]` を既存ネイティブ入力へ変換して発音。本スプリントの実 Renderer。
- **`ToneRenderer`（将来・未実装）**: Web/Tone.js アダプタ。設計書のフル思想を Web で動かす場合の差し替え先。**本スプリントでは作らない**（インターフェースだけ用意し差し替え可能性を担保）。
- Domain（Performance Engine）は `PerformanceRenderer` にのみ依存し、`NativeAudioRenderer` / `ToneRenderer` を import しない。差し替えは Service 層の DI で行う。

### 4.6 変更予定ファイル（§2 に加えて Performance Engine 分）

- **新規**: `src/lib/voiceLeading.ts`（Step 1）／`src/lib/performance/NoteEvent.ts`・`src/lib/performance/PerformanceEngine.ts`・`src/lib/performance/styles/`（Step 2）／`src/lib/performance/PerformanceRenderer.ts`（Renderer 抽象・Step 3）／各 `__tests__`。
- **変更（最小）**: `src/lib/voicing.ts`（`progressionToChordSpecs()` に voiceLeading を差し込む・Step 1）／`src/services/audio/index.ts`（Renderer 抽象の DI 配線・Step 3）／`modules/chord-audio/ios/AudioEngineController.swift`（`NoteEvent` マッピング受け口・音色チューニング・Step 3）。
- **依存追加なし**（Tone.js/smplr 等の Web 系ライブラリは本スプリントでは追加しない）。

---

## 5. 音楽監修（Music Supervisor）を挟むステップ

音関連スプリントのため、**音楽監修を実装の前後に必ず挟む**。順序は以下（引き継ぎ §3 のペルソナ＝音楽理論の専門家かつ現役ミュージシャンに基づく）。

1. **監査 / 実装前レビュー（music-supervisor）**: 対象ファイル（`voicing.ts` / `music.ts` / `AudioEngineController.swift` / `DrumProvider.swift` / `presets.ts`）を監査し、P0/P1/P2 の具体改善案（症状→音楽的理由→ファイル/関数/パラメータ→担当→検証方法）と「着手 TOP3」を `docs/music-supervisor-audit.md` に出力。**コードは修正しない。**
2. **監査結果の転記（@planner）**: 上記を本カード §3 に転記し、変更提案（4点セット）を提示して承認を得る。
3. **実装（@generator）**: 承認された P0/P1 をドメイン層 / ネイティブに実装。骨格（Scheduler/Mixer）は不変、差し替え点の内側で調整。
4. **聴感評価（music-supervisor）**: 実機（または実機に近い書き出し）でボイシング・伴奏・ドラム・テンションの聴感を評価。改善が音楽的に成立しているか、退行がないかを判定。P0/P1 未達は @generator へ差し戻し。
5. **QA（@evaluator）**: §6 の契約と性能（§12 ＋ 設計書 §6 品質ゲート: 継ぎ目/クリック/音割れ/jitter/発熱/メモリ/同 seed 再現）を判定。**音楽的魅力の最終判断は music-supervisor、契約・安定性の判断は evaluator** と責務分離。不合格は該当エージェントへ差し戻し、合格まで反復。

> designer は本スプリントでは原則関与しない（音の変更が中心で見た目変更を伴わないため）。音関連 UI（例: グルーヴ選択の表示）に副次変更が必要な場合のみ designer を挟む。

---

## 6. 完了条件 / 受入基準（Sprint 6 契約）

> 本スプリントは段階実装のため、**Step 1（voice-leading）は最低ラインとして本スプリント内で必達**、Step 2/3 は M4 のネイティブ再ビルド枠まで含めて達成を目指す（未達分は §7 申し送り）。受入基準は音源設計書 §4 の初期受入条件・§6 品質ゲートに準拠。

### @generator への契約（機能・層分離）
- [ ] §3 の音楽監修 P0（＋承認された P1）を実装している
- [ ] **Step 1**: `src/lib/voiceLeading.ts`（新規）を実装し、`voicing.ts` `progressionToChordSpecs()` から呼ぶ。**ネイティブ再ビルド不要**で Metro 反映できる
- [ ] Performance Engine（`src/lib/performance/`）と `NoteEvent` 契約が **RN/Expo・ネイティブ非依存の純ロジック**で実装され、単体テストがある
- [ ] Domain は `PerformanceRenderer` 抽象にのみ依存し、iOS ネイティブ／将来 Web の具象を import していない（Renderer 差し替え可能）
- [ ] 乱数は seed 由来で決定論的（`Math.random` 直呼びが無い）
- [ ] `AudioEngineController` / `Mixer` / `Scheduler` の骨格を作り替えていない（差し替え点の内側で調整）
- [ ] `tsc` 0 / `expo lint` 0 / `jest` パス
- [ ] 未確認ライセンスの音源・Web 系依存（Tone.js 等）をリポジトリに追加していない

### 演奏品質の受入基準（設計書 §4 / 単体テスト＋聴感で判定）
- [ ] **平均声部移動 ≤ 4半音**（voiceLeading。代表進行群で計測）
- [ ] **同一 velocity の 5 連打が無い**（velocity カーブ）
- [ ] **bar 境界のタイミング累積 drift = 0**（microtiming。整数サンプル/絶対時刻基準）
- [ ] **gate は 0.72〜0.95 の範囲**（duration/articulation）、同音再打鍵前に 15〜35ms のギャップ
- [ ] **Round Robin が主要音域×velocity 層で 3 種以上**、同一 sample の連続使用が抑制される
- [ ] 同一 8 小節で単純反復に聞こえない（phrase curve / density）
- [ ] **A/B 聴き比べで Humanized（本エンジン適用版）選好 ≥ 70%**（music-supervisor 主導、可能なら複数名）

### music-supervisor への契約（音楽的魅力）
- [ ] 実装後の聴感評価で、対象領域（ボイシング/伴奏/ドラム/テンション/プリセット）の音楽的魅力が監査前より向上している
- [ ] 既存の聴感方針（block/8・16beat/arpeggio）が意図通り保たれている
- [ ] 転調・全キーで音楽的破綻がない
- [ ] voice-leading 適用で「打ち込み感／貼り付け感」が明確に軽減している（変更前後の書き出し MP4 A/B）
- [ ] P0/P1 の指摘が解消（または残課題が P2 として §7 に申し送り済み）

### @evaluator への契約（契約・安定性・品質ゲート）
- [ ] 4小節×30秒ループでズレ/継ぎ目/クリックが無い（§12-1）
- [ ] **Scheduler jitter p95 ≤ 5ms**（音声 clock 基準。UI thread clock を使わない）※設計書 §6
- [ ] **3 Style × BPM 70/110/160 × 実機で click・dropout・note stuck が 0 件**（設計書 §6）
- [ ] **同一 seed は再現、別 seed は違いがあるが拍感を失わない**（設計書 §6）
- [ ] 既知観察点（`chordSampleValue` 線形走査による高負荷、rock16×sixteenthBeat の音割れ）が悪化していない（実機）
- [ ] 60秒書き出しの発熱/メモリ/所要時間が許容範囲を維持（§12）
- [ ] 音の変更により既存機能（play/pause/resume/stop/ループ/音量/書き出し）が壊れていない
- [ ] エッジケース（空進行 / 16小節上限 / 全ドラム×全伴奏の組合せ）で破綻しない

### 評価履歴
- **2026-07-19 @generator / Step 3（Renderer 接続＋音色チューニング）: 実装完了（静的検証通過・実機未）**
  - PE → `playback` / videoExport 配線。`accompaniment: 'performance'` で 1:1 発音（二重ヒューマナイズ回避）。PE ドラムは送らず native groove 維持。
  - P0-2: `voicing.ts` の C1 サブベース重ねを廃止（C2 のみ）。P1-1/P1-2: `DrumProvider` キッククリック＋スネア整形。P1-4: eightBeat sparkle を強拍のみ。
  - 静的検証: `tsc` 0 / `jest` 17 suites・178 tests / `expo lint` 0。**Swift 反映には EAS 再ビルド必須**。
- **2026-07-19 @evaluator / Step 2（NoteEvent 契約＋Performance Engine）: 合格（静的検証＋契約レビュー）**
  - 静的検証: `tsc --noEmit` 0 / `expo lint` 0 / `jest` 16 suites・**174 tests 全パス**（Step 1 の 129→174、回帰ゼロ）。
  - 受入基準（純ロジック範囲）を確認: 同一 velocity 5連打禁止（`avoidFiveInARow`＋全プリセット×全 style×3 キーで検証）／bar 境界 drift=0（step0 offset=0・絶対位置基準、downbeat が厳密整数）／gate∈[0.72,0.95]（BPM 70/110/160）＋同音再打鍵ギャップ（RESTRIKE_GAP=20ms、テスト ≥15ms）／Round Robin ≥3種・連続同 index 回避／決定論（同 seed→byte 一致、別 seed→pitch 多重集合保存）／microtiming は kick 基準の相関（bar ごと共有 feel＋トラック別 jitter、Bass は kick の ±4ms 以内）／`Math.random` 直呼びゼロ（seed 由来 PRNG のみ）。
  - NoteEvent 契約: 設計書§1 の全フィールド（timeBeat/durationBeat/pitch/velocity/articulation/rrIndex/trackId/seed）を満たす。既存ネイティブ `NoteEvent` とは別型で層分離。
  - 回帰・Step 範囲: `src/lib/performance/` は全て新規・自己完結。エンジンは playback/exportPlan/native/services へ未配線（`generatePerformance` を engine 外から import する箇所ゼロ）。`voicing.ts` の差分は Step 1（voice-leading 統合）のみで Step 2 追加なし。Renderer 実装・ネイティブ変更（Step 3）への先食いなし。
  - 実機未検証（残・Step 3＋実機）: jitter p95≤5ms（音声 clock）、3 Style×BPM の click/dropout/note stuck、4小節×30秒ループの継ぎ目/クリック、60秒書き出しの発熱/メモリ、`chordSampleValue` 線形走査の非悪化、A/B 聴感 Humanized 選好 ≥70%（music-supervisor）。
- **2026-07-19 @evaluator / Step 1（voice-leading）: 合格（静的検証＋契約レビュー）**
  - 静的検証: `tsc --noEmit` 0 / `expo lint` 0 / `jest` 13 suites・129 tests 全パス。
  - 受入基準: 共通音保持・内声移動 ±7半音以内・進行平均移動 ≤4半音・決定論（Math.random 不使用）・音域クランプ[45,72]・和音同一性（PC集合＆音数不変）を、`voiceLeading.test.ts` の代表進行群＋全プリセット×全12キー統合テストで確認。
  - 回帰: `chordMidiNotes` は後方互換（テストが旧値を厳密検証）。プレビュー／鍵盤発光はピッチクラス判定のため voice-leading（転回のみ）で不変。動画は音声＝voice-led／発光＝PC判定で整合。
  - Step 範囲: `src/lib/performance/voiceLeading.ts`（新規）＋`voicing.ts` 最小差分のみ。velocity/microtiming/articulation/NoteEvent/Renderer/ネイティブへの先食いなし。
  - 実機未検証（残）: 実試聴での自然さ（music-supervisor）、ループ継ぎ目/クリック、jitter p95≤5ms、3 Style×BPM の click/dropout/note stuck、60秒書き出しの発熱/メモリ、既知観察点の非悪化。→ Step 3（ネイティブ接続）＋実機で判定。
  - 付記: 作業ツリーに P1-3（`jpop-royal`→4536: F-G-Em-Am）のプリセット/転調テスト更新が同梱。Step 1 とは別項目だが Step 2/3・ネイティブ領域ではなく、テストは全パス。

---

## 7. 次スプリント / V2 への申し送り
- 音楽監修 P2 指摘（本スプリント対象外分）をここに集約する。
- **Performance Engine の Step 2/3 で本スプリント内に完了しなかった分**（velocity/microtiming/articulation の完全 `NoteEvent` 化、Renderer 全面接続）を継続。
- **Web/Tone.js Renderer アダプタ**は将来検討（`PerformanceRenderer` 抽象があるため、Domain 側の再利用で実装可能）。設計書 §5 の Web ロードマップは参考情報として保持。
- サンプルドラム / Pro 音色（アコギ/エレキ/ストリングス）は V2。ライセンス確認済み素材が用意でき次第、`InstrumentProvider` / `DrumProvider` の protocol 準拠で差し替え。設計書 §3 のライセンス4台帳（コード/音声/IR/MIDI・グルーブ）を素材追加時に整備。
- Sprint 1 申し送りの「11th/13th のディグリー別可否の出し分け」は、音楽監修の判断に基づき本スプリントで着手できなかった分を継続。
