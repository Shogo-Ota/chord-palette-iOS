# Chord Palette — 自然な演奏感を実現する音源・演奏エンジン設計書

> 出典: ユーザー提供 `Chord_Palette_自然演奏音源_設計書.docx`（v1.0 / 2026-07-18）。
> 本ファイルは docx の内容をリポジトリ参照用に転記したもの。
>
> **本プロジェクトでの採用方針（2026-07-18 ユーザー決定）**:
> 設計書は「Web/PWA先行・Tone.js」を前提に書かれているが、現行 Chord Palette は **iOS ネイティブ（Expo + Swift `AudioEngineController` + SoundFont / `chord-audio` モジュール）** で 7/31 リリースを目指す。
> したがって **設計書の中核思想（演奏生成を `NoteEvent` として音源から分離する）と §4 の演奏スペックをドメイン層に導入**し、
> **現行 iOS ネイティブ基盤は Renderer として維持・段階接続**する（Web/Tone.js は将来の Renderer アダプタ）。
> 具体作業は **sprint-6（音質・音楽的魅力の向上）** で実施。まず最大 ROI の **voice-leading** から着手する（音楽監修 audit の P0 と一致）。

---

推奨結論: **Tone.js + 自前管理のマルチサンプル + 決定論的 Performance Engine**（※Web前提の元推奨。本プロジェクトでは Performance Engine 部分を採用し Renderer は iOS ネイティブを維持）。

音色だけを豪華にしても機械的な演奏は直らない。コード進行から「ボイシング・リズム・奏法・強弱」を生成し、`NoteEvent` として音源から分離する。試作は VCSL（CC0）、製品版は自社録音または再配布契約済み素材へ差し替える。

## 1. 設計原則と推奨アーキテクチャ

配分:
- **演奏生成 60%** — 拍の重み・省略・タイ・シンコペーション・フレーズ密度を司る。最優先。
- **サンプル 25%** — 3段以上の Velocity Layer、3種以上の Round Robin。素材権利を台帳化。
- **FX / ミックス 15%** — 軽い Room、EQ、Limiter。演奏の欠点をリバーブで隠さない。

処理フロー（音源を差し替えても Performance Engine とスタイル資産は再利用できる構造）:

```
① Chord Input   Key / Chord / BPM
② Voicing       転回・声部連結・音域
③ Performance   Style / Groove / Articulation
④ NoteEvent     beat・pitch・vel・dur・seed
⑤ Renderer      Tone.Transport → Sampler → FX（本PJでは iOS ネイティブ Renderer）
```

**NoteEvent 最小契約**: `{ timeBeat, durationBeat, pitch, velocity, articulation, rrIndex, trackId, seed }`。乱数 seed を保存し、同じ進行は再生ごとに破綻せず再現可能にする。

## 2. 音源方式の比較

| 方式 | 自然さ | 低遅延/容量 | 実装難度 | ライセンス | 判断 |
|---|---|---|---|---|---|
| 発振器／物理モデル | △ 音色は均質 | ◎ / ◎ | 低〜中 | OSSは容易 | UI試聴・ベース補助のみ |
| マルチサンプル（Tone.Sampler） | ◎ 鍵盤・打楽器 | ◎ / ○ | 中 | 素材次第 | ★ 主方式。最短で高品質 |
| SoundFont（SpessaSynth等） | ○ 幅広い音色 | ○ / ◎ | 中 | Bank別確認 | 副方式。GM音色の拡張用 |
| 演奏フレーズ／ループ | ◎ 生演奏そのもの | ◎ / △ | 中 | 再配布が難しい | ギター等の限定スタイル用 |
| iOS Native Sampler | ◎ 低遅延・安定 | ◎ / ○ | 高 | 素材次第 | Web検証後の移植先（※本PJは現行これ） |
| クラウドで Plugin 描画 | ◎ 最高品質可 | × / ◎ | 最高 | OEM契約が必要 | 将来の書き出し専用 |

## 3. ライブラリ／素材候補とライセンス判断

| 候補 | 役割 | ライセンス | 難度 | 判断 | 注意 |
|---|---|---|---|---|---|
| Tone.js | Web Audio制御・Sampler・Transport | MIT | 低 | 採用 | サンプル精度の予約再生。素材権利は別 |
| smplr | 試作向け Sampler / 楽器 preset | Code: MIT | 低 | 試作のみ | 各preset素材ライセンスと外部配信依存を監査 |
| SpessaSynth_lib | SF2/SF3/DLS/MIDI再生 | Apache-2.0 | 中 | Phase 4候補 | SoundFont自体は別ライセンス |
| FluidSynth | Native/Server SoundFont | LGPL-2.1 | 高 | 保留 | リンク・配布義務の設計が必要。Web MVPには過剰 |
| AudioKit / Apple Sampler | iOS音声処理 / SF2・DLS等 | MIT / OS API | 中〜高 | iOS時採用 | Apple Sampler は SF2/DLS/aupreset/EXS24対応 |
| VCSL | 楽器の生サンプル | CC0-1.0 | 中 | ★ 試作採用 | 商用組込み可。整音・マッピング・RR構築は自前 |
| tonejs-instruments | Tone.js用既成音色 | Samples: CC BY 3.0 | 低 | 代替 | クレジット表示とライセンス同梱が必須 |
| GeneralUser GS | 約30MBのGM/GS bank | 独自許諾 | 低 | 商用Bundle非推奨 | 一部sampleの出所不確実性を作者が明記 |
| 商用Kontakt/Spitfire等 | 高品位sample library | 製品EULA | 低 | Bundle不可 | raw sample・派生libraryの再配布は禁止。OEM個別契約前提 |
| sfizz | SFZ C++ engine | BSD-2-Clause | 高 | 新規採用しない | 2026-06-21 archive。保守継続性のため候補外 |

ライセンス原則: コード／音声素材／IR／MIDI・グルーブの **4台帳を分ける**。URL・取得日・版・原作者・許諾文・必要表示・加工履歴・配布可否を asset 単位で保存。法的判断はリリース前に専門家確認。

## 4. 自然なリズム表現：Performance Engine 仕様（★本プロジェクトの中核採用範囲）

| 層 | 実装ルール | 初期受入条件 |
|---|---|---|
| ボイシング | 共通音を保持し、内声の移動を原則 ±7半音以内。旋律トップノートとベース転回を別制御。 | 平均声部移動 ≤ 4半音 |
| グルーブ骨格 | 8Beat / 16Beat / Ballad の3種から開始。拍の強弱・休符・タイ・先取りを確率文法化。 | 同一8小節で単純反復を感じない |
| Microtiming | 独立乱数を禁止。Kick を基準、Bass は ±4ms、Hat は −6〜+4ms、Snare は +4〜+14ms。Style ごとに相関させる。 | Bar境界の累積 drift = 0 |
| Velocity | 拍アクセント × 2/4小節の phrase curve × 音ごとの差。通常揺らぎは MIDI ±4〜7、ghost は 20〜45。 | 同 Velocity の5連打を禁止 |
| Duration／奏法 | Gate 0.72〜0.95、同音再打鍵前に 15〜35ms 離す。Tie/Legato/Pedal、Strum は 8〜35ms で方向差を持たせる。 | Note overlap／音切れ破綻なし |
| Round Robin | 各主要音域 × Velocity 層で3種類以上。同一 sample の連続使用を避け、seed で再現可能に選択。 | Machine-gun 感の聴感減少 |
| フレーズ構造 | 4/8小節で密度を上げ下げ。Fill は終端のみ、毎回鳴らさない。コードチェンジ直前の先取りは最大 1/8拍。 | A/B で Humanized 選好 ≥ 70% |

- **やること**: 人が弾いた MIDI からタイミング／Velocity の分布を抽出し、Style preset にする。乱数は「演奏者の癖」に従属させる。
- **やらないこと**: 全 Note を一律 ±20ms で揺らす、常時 Swing、常時 Fill、リバーブ過多、ギターを鍵盤 sample だけで再現する。

## 5. 実装ロードマップ（Web製品版まで 8〜12週。※本PJは iOS ネイティブに読み替えて sprint-6 で段階採用）

| Phase | 目安 | 実装内容 | Exit Criteria |
|---|---|---|---|
| 0. 基準固定 | 2〜3日 | 参照音源3曲、対象端末、音質評価表、asset台帳を確定。既存の機械的再生を Baseline 録音。 | 「自然」の判断を言語化 |
| 1. Audio Spine | 1〜2週 | Tone.js、sample cache、Transport予約、NoteEvent、seed、再生停止／tempo変更、Limiter。 | Cold start ≤1.5s／warm発音 ≤80ms |
| 2. Performance MVP | 2週 | ボイシング、8Beat/16Beat/Ballad、accent、tie、microtiming、duration、RR。 | 3 Style × 10進行で破綻ゼロ |
| 3. Rhythm Section | 2週 | Bass を Kick へ同期、Drums の ghost/fill、4/8小節 phrase、density 3段階。 | 8小節の単調感を聴感評価 |
| 4. Sound Polish | 2〜4週 | VCSL整音→必要なら自社録音へ置換。3 velocity層×3 RR、Room IR、EQ、download最適化。 | 初期音声転送 ≤15MB／clipping 0 |
| 5. 製品化Gate | 1週 | 10人の blind A/B、Safari/Chrome/Android、低速回線、license review、計測導入。 | Humanized選好 ≥70% |
| 6. 拡張 | 検証後 | GM音色は SpessaSynth、iOS は AVAudioUnitSampler/AudioKit、WAV書出しは OfflineAudioContext。 | 利用率で投資判断 |

## 6. 品質ゲートとリスク制御

必須品質ゲート:
- Scheduler jitter: p95 ≤ 5ms（音声 clock 基準、UI thread clock を使わない）
- 3 Style × BPM 70/110/160 × 主要端末で click・dropout・note stuck 0件
- 同 seed は再現、別 seed は違いがあるが拍感を失わない
- asset台帳 100%、必要な NOTICE／CC 表示をビルドに同梱

主要リスク／対策:
- ギター: 最難関。MVP は鍵盤中心、後に up/down/mute 別 sample か phrase 方式
- Mobile Safari: 初回 tap で AudioContext resume、復帰時の再初期化を試験
- 容量: 音域別 lazy load、Ogg/AAC 等の実機 decode 品質を比較、CDN は自前管理
- ライセンス: 出所不明 SoundFont と市販 library の raw sample を Bundle しない

投資判断ルール: A/B で勝てない状態で音色数を増やさない。まず 3 Style の「気持ちよさ」を完成させ、その後に楽器を広げる。

## 7. 参照した一次情報（2026-07-18 確認）

Tone.js（MIT）／smplr（Code: MIT）／SpessaSynth_lib（Apache-2.0）／FluidSynth（LGPL-2.1）／AudioKit（MIT）／Apple AVAudioUnitSampler／VCSL（CC0）／GeneralUser GS License／tonejs-instruments（Samples: CC BY 3.0）／Spitfire Audio EULA（再配布制限例）。

補足: sfizz は BSD-2-Clause だが、公式 GitHub が 2026-06-21 に archive 済みのため新規採用候補から除外。記載は技術・事業判断用であり、法的助言ではない。
