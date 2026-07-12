# Sprint 2 — ネイティブ音楽エンジン（Phase 2）実装カード

正典: `Chord_Palette_iOS_MVP_Requirements_v1.md` ＋ 本カード。
前提: Apple Developer Program 登録済み（個人 / Team ID: VC4Y4AWS2K）。Phase 1 は `@evaluator` 合格・コミット済み（`5b9d51c`）。

> Phase 2 からは **Expo Go は動作保証対象外**（カスタムネイティブモジュールのため）。実機確認は **EAS Development Build** で行う。
> **Phase 2A（技術経路の検証）→ Phase 2B（本番音源）** の二段構え。本カードは主に **2A** を対象とし、2B は方針のみ記載する。

---

## 0. 確定した方針（ユーザー承認済み）

- **音源方式は一方式に固定しない**。
  - **2A**: (c) 内蔵合成／最小限のプログラム生成音。目的は Expo Custom Native Module・EAS Dev Build・AVAudioEngine・同期再生・ループの**技術経路検証**。本番音源にしない。音質調整は対象外。
  - **2B**: (b) ライセンス確認済みの高品質サンプルへ移行（Piano / E.Piano / ドラムワンショット優先）。汎用 GM SoundFont を本番前提にしない。ライセンス未確認の音源はリポジトリに追加しない。
- **音源は AudioEngine に密結合させない**。`InstrumentProvider` として責務分離し、2A の合成音を後から `AVAudioUnitSampler` / マルチサンプルへ差し替え可能にする。
- **ビルド**: EAS クラウドビルド＋実機 iPhone 1台登録。Swift/ネイティブ設定変更後は Dev Build 再作成、TS のみの変更は Metro 経由。実機未確認の項目は「確認済み」と記載しない。
- **音量は最初から3系統**（Master / Chord / Drum）をネイティブ実装。

---

## 1. Phase 2A と 2B の境界

### Phase 2A（本スプリントの実装対象）
- EAS Development Build の土台
- ローカル Expo Custom Native Module（`modules/chord-audio`）
- `AVAudioSession` / `AVAudioEngine` の初期化
- 最小音源（プログラム生成）でのコード単体試聴
- 固定検証進行 **Cmaj7 → G7 → Am7 → Fmaj7**（各1小節 / 120 BPM）
- **Pop 8beat の最小ドラムパターン**
- コードとドラムの**同期**
- **30秒以上のループ**
- **Chord / Drum / Master の音量制御**
- 再生位置イベント（現在の拍/コードindex）
- **検証専用画面**（本番編集画面には統合しない）
- Windows＋EAS＋実機の確認手順（README）

### Phase 2A の対象外（→ 2B 以降）
- 高音質 Piano 音源 / E.Piano / Guitar / Strings
- 本格的なエフェクト
- 動画書き出し（Phase 3）
- 本番編集画面（editor/groove）への全面統合
- RevenueCat / Convex / Clerk / SNS
- AudioKit（使用しない）
- 伴奏パターン（8beat/16beat/Arpeggio）とグルーブ全種（2A は Pop 8beat 最小のみ）

### Phase 2B（次スプリント・方針のみ）
- `InstrumentProvider` 実装を合成音 → サンプル方式へ差し替え（Piano/E.Piano/ドラムワンショット優先）
- 全音色（Pro 含む）・全伴奏パターン・全ドラムグルーブ
- 本番編集画面 `editor.tsx` / `groove.tsx` への統合、Pro 音色ゲート結線
- 音質・レイテンシ・エフェクトの詰め

---

## 2. 変更予定ファイル

### 変更
- `package.json` — `expo-dev-client` 追加
- `app.json` — dev-client / ローカルモジュール整合（不要な権限は足さない）
- `README.md` — EAS Development Build 手順（Windows・ビルド・インストール・ログ・再ビルド）と 2A の位置づけ
- `.gitignore` — 生成 native ディレクトリ（`/ios` `/android` は既存除外）と音源ライセンス関連の確認

### 新規
- `eas.json` — development / preview / production プロファイル
- `modules/chord-audio/`（ローカル Expo Module）
  - `expo-module.config.json`
  - `index.ts` — JS エントリ（型付き公開 API）
  - `src/ChordAudio.types.ts` — Native Module API 型定義
  - `src/ChordAudioModule.ts` — `requireNativeModule` ラッパ
  - `ios/ChordAudioModule.swift` — Expo Module 定義（関数・イベント）
  - `ios/AudioEngineController.swift` — AVAudioEngine/セッション/ミキサー管理
  - `ios/Mixer.swift` — 3系統ミキサー構成
  - `ios/InstrumentProvider.swift` — 音源抽象（protocol）
  - `ios/SynthInstrumentProvider.swift` — 2A の合成音実装
  - `ios/DrumProvider.swift` — 2A の最小ドラム（合成/ワンショット風）
  - `ios/Scheduler.swift` — サンプルタイム基準の発音スケジューラ（同期・ループ）
- `src/services/audio/index.ts` — 画面から使う音声サービス抽象（native を直接触らせない）
- `src/services/audio/types.ts` — サービス層の型（音量範囲/初期値/永続化対象を含む）
- `src/services/audio/__tests__/schedule.test.ts` — 進行→発音スケジュール変換の純粋ロジック単体テスト
- `src/app/dev-audio.tsx` — **検証専用画面**（開発用ルート。本番導線からは隠す）
  - ※Expo Router 構成を調査した結果、**ルートルートは `src/app/`**（`src/app/_layout.tsx` が存在、`app.config`/export も "Using src/app as the root directory" を確認）。よって新たに `app/` を作らず、既存構成に合わせ `src/app/dev-audio.tsx` を使用する。
  - 検証用の固定進行（Cmaj7→G7→Am7→Fmaj7）は**この画面または `src/app/__fixtures__` / サービス層の fixture** に置き、`AudioEngineController` / `Scheduler` へは埋め込まない。

---

## 3. Native Module API（`modules/chord-audio`）

TS 型（`src/ChordAudio.types.ts`）で定義し、Swift 実装と一致させる。**固定進行は Swift へハードコードしない**。イベントデータは TS 側（fixture / 検証画面）で生成し、汎用 `PlaybackRequest` として Native へ渡す。

```ts
/** 音量は 0.0–1.0。範囲外はクランプ。永続化は TypeScript/SQLite 側を正典とする（§5.1）。*/
export type VolumeChannel = 'master' | 'chord' | 'drum';
export interface VolumeLevels {
  master: number; // 0.0–1.0, default 0.9
  chord: number;  // 0.0–1.0, default 0.85
  drum: number;   // 0.0–1.0, default 0.8
}

/** 再生状態機械（§3.1）。Native が単一の真実として保持し、getState/onStateChange で公開。*/
export type PlaybackState =
  | 'idle'       // prepare 前
  | 'preparing'  // AVAudioSession/Engine 初期化中
  | 'ready'      // 初期化完了・未再生
  | 'playing'
  | 'paused'
  | 'stopped'    // 明示停止（位置リセット）
  | 'failed';    // 初期化/再生エラー

/** 汎用の発音イベント。固定進行に依存しない（2B の本番 ChordEvent もこれへ変換して渡す）。*/
export interface NoteEvent {
  midiNotes: number[]; // 同時発音ノート（例: Cmaj7 = [60,64,67,71]）
  startBeat: number;   // 進行先頭からの開始拍（共通基準）
  lengthBeats: number; // 長さ（拍）
  velocity: number;    // 0–127
}

/** 汎用再生リクエスト。Swift 側はこれを解釈するだけで、進行内容を内部に持たない。*/
export interface PlaybackRequest {
  bpm: number;             // 40–300
  totalBeats: number;      // 進行全体の拍数（ループ境界）
  loop: boolean;
  chordEvents: NoteEvent[];
  drumPatternId: string;   // 例: 'pop8-min'（Native がパターン定義を保持）
}

/** 単体試聴（コードカード相当）*/
export interface PreviewRequest {
  midiNotes: number[];
  velocity: number;   // 0–127
  lengthBeats?: number; // 省略時は既定
  bpm?: number;         // 省略時は既定
}

/** 再生位置イベント（UI表示専用。再生クロックには使わない）*/
export interface PositionEvent {
  chordIndex: number; // 現在のコード index
  beat: number;       // 経過拍
  loopCount: number;  // 何周目か
}

export interface ChordAudioModule {
  // ライフサイクル / セッション
  isAvailable(): boolean;
  getVersion(): string;
  getState(): PlaybackState;
  prepare(): Promise<void>;              // idle/failed → preparing → ready
  teardown(): Promise<void>;             // → idle（エンジン解放）

  // 単体試聴
  previewChord(req: PreviewRequest): Promise<void>;

  // 進行再生（状態遷移は §3.1）
  play(req: PlaybackRequest): Promise<void>; // ready/stopped/paused → playing
  pause(): Promise<void>;                    // playing → paused（位置保持）
  resume(): Promise<void>;                   // paused → playing（保持位置から）
  stop(): Promise<void>;                     // playing/paused → stopped（位置リセット）

  // 音量（3系統・最初から実装）
  setMasterVolume(value: number): void;  // 0.0–1.0
  setChordVolume(value: number): void;   // 0.0–1.0
  setDrumVolume(value: number): void;    // 0.0–1.0

  // イベント（EventEmitter）:
  //  'onPosition'    → PositionEvent（UI表示専用）
  //  'onStateChange' → { state: PlaybackState }
}
```

### 3.1 PlaybackState と操作の定義

| 現状態 | play() | pause() | resume() | stop() |
|---|---|---|---|---|
| idle | 失敗(要 prepare) | 無視 | 無視 | 無視 |
| preparing | 無視/キュー | 無視 | 無視 | 無視 |
| ready | 先頭から再生→playing | 無視 | 無視 | 無視 |
| playing | 先頭へ巻き戻して再生（再スタート） | →paused（位置保持） | 無視 | →stopped |
| paused | 先頭から再生→playing | 無視 | 保持位置から→playing | →stopped |
| stopped | 先頭から再生→playing | 無視 | 無視 | 無視 |
| failed | 失敗(要 prepare) | 無視 | 無視 | 無視 |

- `play()` は「再開兼用」にしない。再開は必ず `resume()`。`play()` は常に先頭からの新規再生。
- 無効遷移は例外を投げず no-op（`onStateChange` は発火しない）。`failed` からの回復は `prepare()` 再実行。

## 4. Swift 側クラス構成

- `ChordAudioModule`（`Module` 定義）: JS からの関数受け口、イベント送出（`onPosition`）。ロジックは持たず委譲。
- `AudioEngineController`: `AVAudioSession` 設定（`.playback`）、`AVAudioEngine` の生成/開始/停止、ノードの接続、ライフサイクル。
- `Mixer`: 3系統のミキサーノード（下記§5）を保持・音量適用。
- `InstrumentProvider`（protocol）: 「あるコードを与えられた時刻に発音する」責務を抽象化。`prepare()`, `scheduleChord(_:at:)`, `noteOff(...)` 等。
- `SynthInstrumentProvider`（2A 実装）: `AVAudioSourceNode`（または軽量オシレータ）で単純波形＋短いエンベロープを生成。**本番品質ではなく技術検証専用**である旨を Swift のクラスヘッダコメントと本ドキュメントに明記する。コメントだけに頼らず、`InstrumentProvider` protocol を介して 2B の Sampler / マルチサンプル実装へ交換できる構造を実際に用意する（呼び出し側は provider の具象型に依存しない）。
- `DrumProvider`（2A 実装）: Pop 8beat 最小パターン（キック/スネア/ハイハットを合成音/ノイズバーストで近似）。将来ワンショット samplerへ差し替え可能な protocol 準拠。
- `Scheduler`: エンジンのサンプルタイム（`AVAudioTime`）基準で、コードとドラムのイベントを先読みスケジュール。ループ境界の継ぎ目なし再生と、再生位置の算出（→ `onPosition`）を担当。JS タイマーは使わない。

> 差し替え点は `InstrumentProvider` / `DrumProvider` の protocol のみ。`AudioEngineController` / `Mixer` / `Scheduler` は 2B でも再利用。

### 4.1 AVAudioSession 設定（Phase 2A）

- **category**: `.playback` — 音楽再生用途。**サイレントモード中でも音を鳴らす**（作曲アプリとして再生は主要機能のため）。
- **mode**: `.default`。
- **options**: 既定では**他アプリの音を停止（非mix）**とする（`.mixWithOthers` は付けない）。理由: 試聴/再生は集中して聴く用途で、他アプリ音とのミックスは不要かつタイミング検証の妨げになるため。将来 mix が必要なら options を切替。
- 選定理由: サイレントスイッチに関わらず再生できることが作曲アプリの基本要件。録音・計測用途はないため `.playAndRecord` は使わない（不要な権限を避ける）。

想定挙動（実機で確認する対象）:
- **サイレントモード**: 音を鳴らす（`.playback` のため）。
- **他アプリ音**: 本アプリ再生開始時に他アプリ音は停止（非mix）。
- **イヤホン取り外し**（route change: old device unavailable）: **自動的に一時停止**（`AVAudioSession.routeChangeNotification` を監視し `.oldDeviceUnavailable` で pause）。勝手にスピーカーで鳴らし続けない。
- **割り込み**（電話等 / `interruptionNotification`）: `.began` で pause、`.ended` かつ `shouldResume` の場合も**自動 resume はせず paused のまま**にし、UI から再開（誤爆再生を避ける）。
- **フォアグラウンド復帰**: エンジンが停止していれば再構築し `ready`/`paused` を維持。二重生成しない（§8 の Fast Refresh 対策と同じ番兵）。

### 4.2 Scheduler の同期基準（必須要件）

- コードとドラムは**同一のサンプルタイム（`AVAudioTime` / エンジンのサンプルクロック）** を参照する。ホストタイムを使う場合も両者で単一基準に統一する。
- **JavaScript から音を逐次スケジュールしない**。TS は `PlaybackRequest` を一度渡すのみ。個々の発音時刻計算・スケジュールは Native の `Scheduler` が行う。
- 各イベントの時刻は**共通の基準時刻（再生開始サンプル）＋ `startBeat` からの絶対計算**で求める。前イベントの終了時刻に誤差を足し込む累積加算はしない。
- **ループ時に累積誤差を次周へ持ち越さない**。周回 N の基準 = 再生開始サンプル ＋ N × (totalBeats × 秒/拍 × サンプルレート) を整数サンプルで確定し、各周を絶対時刻から再計算する。
- `onPosition` は **UI 表示専用**。表示は再生クロックから算出した値を通知するだけで、**発音タイミングの生成には一切使わない**（UI 通知が遅延/欠落しても音はズレない）。

## 5. Mixer 構成

```
Chord source (InstrumentProvider) → Chord mixer ┐
                                                 ├→ Master mixer → Output(main)
Drum source  (DrumProvider)       → Drum mixer  ┘
```

- `setChordVolume` → Chord mixer.outputVolume
- `setDrumVolume`  → Drum mixer.outputVolume
- `setMasterVolume`→ Master mixer.outputVolume
- UI 表示は当面 Chord / Drum の2つ。Master は内部既定値（または検証画面のサブ項目）。

### 5.1 音量の永続化（正典 = TypeScript / SQLite）

- 音量値の**正典は TypeScript / SQLite 側**。Native は**実行中の現在値のみ**保持し、`UserDefaults` 等の**Native 固有ストレージには保存しない**。
- 保存先: `app_meta`（または専用テーブル）に `volume_master` / `volume_chord` / `volume_drum` を保存（`src/repositories` 経由）。
- 起動フロー: アプリ起動時に SQLite から `VolumeLevels` を復元 → `src/services/audio`（AudioService）が `prepare()` 後に `setMasterVolume/setChordVolume/setDrumVolume` で Native へ適用。
- 変更フロー: UI 変更 → AudioService が (1) Native へ即時反映 (2) SQLite へ保存（デバウンス可）。Native 側からは永続化しない。

## 6. 最小音源の生成方式（2A）

- コード: `SynthInstrumentProvider` が各ノートを **単純波形（サイン or 三角）＋短い AD エンベロープ**で合成。ポリフォニー（4音）対応。
- ドラム: `DrumProvider` が Pop 8beat 最小（例: キック=低周波サイン短音、スネア=ノイズバースト、ハイハット=高域ノイズ短音）を拍位置で発音。
- 目的は「鳴って・同期して・ループする」ことの確認のみ。**音質・音色の作り込みはしない**。
- 実装は provider 内に閉じ、`AudioEngineController` からは protocol 経由でのみ利用（2B でサンプル方式へ丸ごと差し替え可能）。

## 7. EAS Development Build 手順（Windows・READMEにも記載）

前提: Expo アカウント、`npx eas` 利用。Apple ログインはユーザー自身の操作で行う（認証情報保護のため）。

```bash
# 1) 依存追加（TS変更）
npx expo install expo-dev-client

# 2) EAS 初期化（初回のみ・プロジェクト登録）
npx eas init

# 3) iOS 開発ビルド（クラウド）。Apple ログイン → 実機UDID登録は対話で進む
npx eas build --profile development --platform ios

# 4) ビルド完了後、表示URL/QR から実機にインストール（.ipa を Ad Hoc 配布）

# 5) 開発サーバー起動（Dev Client 用）
npx expo start --dev-client

# 再ビルドが必要なケース: Swift / app.json / ネイティブ設定 / 新規ネイティブ依存の変更
# 再ビルド不要なケース: TypeScript / JS のみの変更（Metro が反映）

# ログ確認: 端末をDev Clientで起動し、`expo start` のターミナル、または Xcode不要でEASの実機ログ/コンソール出力を参照
```

- `eas.json` に development プロファイル（`developmentClient: true`, `distribution: "internal"`）を定義。
- 実機は今の iPhone 1台を登録。

## 8. 実機テスト項目（2A・実機で確認できたものだけ「確認済み」と記す）

実機確認日: 2026-07-12 / 端末: iPhone（UDID 00008150-001919A02639401C）/ ビルド: EAS Development Build（package.json 追加後の再ビルド）。
※自動テスト結果（§A-3 の tsc/lint/jest/expo-doctor/export）とは別。以下は**実機での挙動確認**。

確認済み（✅）:
- [x] Development Build が生成でき、実機で起動する
- [x] 検証専用画面（`/dev-audio`）が開く（ホーム右上の歯車を一時導線に）
- [x] ネイティブモジュール到達（`requireOptionalNativeModule('ChordAudio')` が非 null。「未リンク」赤バナー非表示）
- [x] `prepare()` で `state: ready` に遷移
- [x] コード単体試聴（Cmaj7）が鳴る
- [x] Cmaj7→G7→Am7→Fmaj7（各1小節/120BPM）が再生される
- [x] Pop 8beat 最小ドラムが鳴る
- [x] コードとドラムが**ずれずに同期**する
- [x] Chord / Drum / Master の音量変更が即座に反映
- [x] 再生位置イベントで現在コードのハイライトが進む
- [x] **停止後の再再生**（stop → play）が正しく動く
- [x] **一時停止後の再開**（pause → resume）が保持位置から動く
- [x] ループ 2周以上で継ぎ目破綻・ズレなし
- [x] **音量 0.0 と 1.0**（Master/Chord/Drum 各々）で正しく無音/最大になる
- [x] **画面遷移（/dev-audio から戻る）後にエンジンが解放**され、音が鳴り続けない・クラッシュしない

未確認（実機で今後確認 / 任意）:
- [ ] **30秒以上・10周以上**の長時間ループでの継ぎ目・累積ズレ（2周以上までは確認済み）
- [ ] **10回以上の連続再生・停止**でのクラッシュ/音欠け/状態不整合
- [ ] **Fast Refresh 後に二重エンジンが生成されない**
- [ ] **イヤホン取り外し**で自動一時停止し、スピーカーで鳴り続けない
- [ ] **アプリのバックグラウンド移行→復帰**で異常終了せず、状態を維持
- [ ] 電話等の**割り込み**で pause、復帰後は自動再生せず UI から再開できる

> 備考: 2A の音色は `SynthInstrumentProvider` による技術検証用合成音（エレピ風）。本番音色は 2B で差し替え。

## 9. 完了条件（Sprint 2A 契約）

- [ ] §8 の実機テスト項目をすべて満たす（実機確認済み）
- [ ] `modules/chord-audio` の Swift 実装が JS から型付きで呼べる
- [ ] Mixer 3系統（Master/Chord/Drum）が機能
- [ ] 音源が `InstrumentProvider` として分離され、2B 差し替え可能な構造
- [ ] 進行→発音スケジュール変換の単体テストがパス
- [ ] `tsc` 0 / `expo lint` 0 / `npm test` パス
- [ ] README に Windows＋EAS＋実機手順が記載
- [ ] `@evaluator` 合格（デザイン4基準の回帰なし。検証画面は簡素でよいが破綻しない）

## 10. Phase 2B への差し替え方針

- `SynthInstrumentProvider` / `DrumProvider` を、ライセンス確認済みサンプルを用いる実装（`AVAudioUnitSampler` またはマルチサンプル）へ**protocol 準拠のまま差し替え**。`AudioEngineController` / `Mixer` / `Scheduler` は不変。
- 音源アセットはライセンス（商用再配布可）を確認できたもののみ追加。未確認はリポジトリに入れない。ライセンス表記を `docs/` に記録。
- Piano / E.Piano / ドラムワンショットを優先。GM SoundFont を本番前提にしない（候補にする場合も音質・ライセンスを確認）。
- 本番編集画面（`editor.tsx` / `groove.tsx`）へ統合し、音色/伴奏/グルーブ/テンポ/音量を結線、Pro 音色ゲートを適用。

### 音色スコープの調整（ユーザー承認 2026-07-12）

- **無料**: Piano（グランドピアノ）/ E.Piano を 2B で実装。
- **Palette Pro**: Strings を 2B 候補として実装検討。
- **Acoustic Guitar / Electric Guitar は当面スコープ外**（実装難度が高いため保留）。将来必要になった時点で再検討。要件定義上の Pro 音色一覧からは「保留」扱いとし、UI 上はロック表示にとどめるか非表示にするかは 2B 着手時に決定する。
