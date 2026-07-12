# Sprint 4 — ネイティブ動画書き出し（Phase 4）実装カード

正典: `Chord_Palette_iOS_MVP_Requirements_v1.md`（特に §5.10 / §7.3 / §10.3）＋ 本カード。
前提: Phase 2A/2B（`chord-audio`）は master 統合済み・実機で再生確認済み。書き出し画面のプレビュー（`export.tsx` + `ChordKeyboard`）は「動画の見た目の基準」として実装済み（コミット済み）。

> Phase 4 は **新規カスタムネイティブモジュール（`chord-video-export`）＋ `expo-media-library` 追加**を伴うため **EAS 再ビルド必須**。TS のみの変更は Metro 経由。
> **4A（技術経路の実証）→ 4B（仕上げ）** の二段構え。本カードは両方を記載し、まず 4A を実装対象とする。

---

## 0. 確定した方針（ユーザー承認済み）

- **見た目の基準は既存プレビュー**（`export.tsx` / `ChordKeyboard`）。native はこの構図を Core Graphics で再現する（背景ダークグラデ＋大コード名＋度数ラベル＋鍵盤ハイライト＋進行ドット＋任意ウォーターマーク）。配色は**アプリ基調＋機能色**（トニック緑 / サブドミ黄 / ドミナント赤）。
- **音楽ロジックはドメイン層（JS）に集約**。native は「描画プラン」を受け取って描画・符号化に専念する。コード→MIDI（`chordMidiNotes`）・スケジュール（`schedule`）・機能色は JS 側で確定させて渡す。
- **音声は native でオフライン決定論レンダリング**（JSタイマー非依存、仕様 §5.10）。既存 `chord-audio` の合成/サンプル音源・Scheduler・Mixer を manual rendering で再利用する。
- **強制ウォーターマークにしない**（デフォルト OFF、任意で表示）。仕様 §5.10 / §10.3。
- **段階実証**: 4A は短尺（15秒）で「実 MP4・音声同期・写真保存」までを最短で通す。60秒の発熱/メモリ/時間は 4A の実機計測で判断してから 4B で詰める。

---

## 1. 4A と 4B の境界

### Phase 4A（本スプリントの第一実装対象）
- `chord-audio` に **オフライン音声書き出し** API を追加：進行＋ドラムを指定秒数ぶんループし一時 `.m4a` を生成して URL を返す。
- 新規ローカルモジュール **`modules/chord-video-export`**（Swift / AVFoundation）：
  - `AVAssetWriter` で **9:16 / 1080×1920 / 30fps** の MP4 を生成。
  - フレーム描画（Core Graphics）: 背景グラデ＋**大コード名**＋**鍵盤ハイライト**（最小構成）。
  - 上記オフライン音声を `AVAssetReader` で読み、映像と多重化。
- JS 側「描画プラン」構築（`src/lib/exportPlan.ts`・純粋）＋サービス抽象化（`src/services/videoExport`）。
- `export.tsx`「写真に保存」を実処理化（`expo-media-library`）。**15秒**固定で実機実証。

### Phase 4A の対象外（→ 4B）
- 度数ラベル / 進行ドット / オクターブ表記 / タイトル・メタ描画の作り込み
- ウォーターマーク描画トグル
- 15/30/60秒の尺切替（4A は 15秒固定）
- 共有シート（`expo-sharing`）、書き出し進捗UI、失敗表示・リトライ
- 分析イベント（`video_export_*`）
- 60秒の実機性能チューニング

### Phase 4B（仕上げ）
- タイトル/キー/BPM/小節・度数ラベル・進行ドット・オクターブ表記・ウォーターマークの完全描画（プレビューと一致）
- 尺 15/30/60秒（進行を尺までループ）
- 共有シート、進捗イベントの UI 表示、キャンセル、失敗時のエラー表示とリトライ
- 分析イベント（PostHog は未導入のため当面 `logger` にスタブ、Phase では送信しない）
- 60秒書き出しの発熱/メモリ/時間の実機計測と最適化（解像度/fps/描画コスト調整）

---

## 2. 変更予定ファイル

### 新規
- `modules/chord-video-export/`（ローカル Expo Module）
  - `expo-module.config.json` / `package.json`（autolinking 用。`chord-audio` の手順を踏襲）
  - `index.ts`（型付き公開 API）
  - `src/ChordVideoExport.types.ts` / `src/ChordVideoExportModule.ts`（`requireNativeModule` ラッパ）
  - `ios/ChordVideoExportModule.swift`（Expo Module 定義・`exportVideo`・進捗イベント）
  - `ios/VideoWriter.swift`（`AVAssetWriter` 映像＋音声多重化）
  - `ios/FrameRenderer.swift`（Core Graphics フレーム描画）
  - `ios/KeyboardLayout.swift`（`src/lib/keyboard.ts` の Swift 移植・鍵盤ジオメトリ）
  - `ios/ChordVideoExport.podspec`
- `src/lib/exportPlan.ts`（描画プラン構築・純粋）＋ `src/lib/__tests__/exportPlan.test.ts`
- `src/services/videoExport/index.ts`（サービス抽象化：プラン構築→音声→動画→保存/共有）

### 変更
- `modules/chord-audio/ios/AudioEngineController.swift` — `renderToFile(request, seconds)`（manual rendering オフライン書き出し）
- `modules/chord-audio/ios/ChordAudioModule.swift` — `AsyncFunction("renderAudioFile")`
- `modules/chord-audio/src/ChordAudio.types.ts` / `ChordAudioModule.ts` — 型・ラッパ追加
- `app.json` — `expo-media-library` プラグイン＋`NSPhotoLibraryAddUsageDescription`（4B で `expo-sharing`）
- `package.json` — `expo-media-library` / `expo-sharing` / `expo-file-system`
- `src/app/export.tsx` — 「写真に保存／共有」の配線・（4B）進捗/失敗UI
- `README.md` — Phase 4 の再ビルド手順・権限・書き出し検証手順

---

## 3. ネイティブ API（型）

```ts
// chord-audio に追加：オフライン音声書き出し
type RenderAudioRequest = {
  bpm: number;
  totalBeats: number;
  chordEvents: NoteEvent[]; // 既存 PlaybackRequest と同形
  drumPatternId: string;
  instrument: string;
  durationSec: number; // 尺（進行を超える分はループ）
};
renderAudioFile(req: RenderAudioRequest): Promise<{ uri: string; sampleRate: number }>;

// chord-video-export：動画書き出し
type ExportSegment = {
  displayName: string;   // 例 "Cmaj7"
  degreeLabel: string;   // 例 "IM7"
  colorHex: string;      // 機能色
  midiNotes: number[];   // 鍵盤ハイライト対象
  startSec: number;
  durationSec: number;
};
type ExportPlan = {
  width: number;         // 1080
  height: number;        // 1920
  fps: number;           // 30
  durationSec: number;   // 15 | 30 | 60
  audioUri: string;      // renderAudioFile の結果
  title: string;
  keyLabel: string;      // "C" 等（音名表記）
  bpm: number;
  bars: number;
  watermark: boolean;
  keyboardLow: number;   // 36
  keyboardHigh: number;  // 60
  segments: ExportSegment[]; // 尺まで敷き詰め済み
};
exportVideo(plan: ExportPlan): Promise<{ uri: string }>; // 一時 MP4 の URL
// 進捗: onProgress { progress: 0..1 }（4B で UI 表示）
```

---

## 4. 同期基準（映像↔音声）

- **単一タイムライン**：音声・映像とも「拍→サンプル/秒」変換（既存 `schedule.ts` / `Scheduler.swift`）を唯一の基準にする。JS の `setTimeout` を同期の中核にしない。
- 音声：`renderAudioFile` が manual rendering で `durationSec` ぶんを決定論生成（拍→フレーム）。
- 映像：フレーム `f` の時刻 `t = f / fps`。`t` が属するセグメント（`startSec ≤ t < startSec+durationSec`）を描画。セグメントは尺までループ済み。
- 検証：出力 MP4 を再生し、コード切替と音の切替が耳・目で一致（≤ 1フレームずれ目標）。

---

## 5. リスクと対策
- **60秒の発熱/メモリ/時間**（仕様が明記）→ 4A は 15秒で実証、実機計測後に 4B で fps/描画最適化。
- **JP タイトルのフォント**→ iOS システムフォント（`.systemFont`）を使用（JP グリフを含む）。コード名/度数は Latin。
- **`AVAssetWriter` のピクセルフォーマット**→ `kCVPixelFormatType_32BGRA` + `CGContext`（BGRA/premultiplied）。
- **新モジュール autolinking**→ `chord-audio` で確立済み（`package.json` + `expo-module.config.json`）。
- **音声/映像長の不一致**→ 音声を尺に丸め、映像フレーム数 = `round(durationSec*fps)` に固定。

---

## 6. 実機テスト項目（実機で確認できたものだけ「確認済み」と記す）

### 4A
- [ ] EAS 再ビルドで新モジュールがリンクされる（`requireOptionalNativeModule('ChordVideoExport')` 非 null）
- [ ] `renderAudioFile` が `.m4a` を生成し URL を返す
- [ ] `exportVideo` が 15秒 / 9:16 / 1080×1920 の MP4 を生成
- [ ] 写真アプリに保存され、再生できる
- [ ] 動画内のコード表示（大コード名＋鍵盤ハイライト）と**音声が同期**
- [ ] 書き出し中にクラッシュ・無音・真っ黒フレームが無い

### 4B（追記予定）
- [ ] 15/30/60秒を選べる
- [ ] タイトル/度数/進行ドット/ウォーターマーク（ON/OFF）が正しく描画
- [ ] 共有シートが開く
- [ ] 進捗表示・失敗時のエラー表示とリトライ
- [ ] 無料でも強制ウォーターマークが入らない
- [ ] 60秒書き出しの発熱/メモリ/所要時間が許容範囲

---

## 7. 完了条件（仕様 §10.3 準拠）

### 4A 完了条件
- [ ] `renderAudioFile` / `exportVideo` が JS から型付きで呼べる
- [ ] 15秒 MP4（9:16・1080×1920）を生成し写真保存できる
- [ ] 動画内コード表示と音声が同期（実機確認）
- [ ] `tsc` 0 / `expo lint` 0 / `npm test` パス（`exportPlan` 単体テスト含む）
- [ ] README に Phase 4 再ビルド・権限・検証手順

### 4B 完了条件
- [ ] 15/30/60秒・完全な描画・共有・進捗/失敗UI
- [ ] 無料ユーザー出力に強制ウォーターマークが入らない
- [ ] `@evaluator` 合格

### 評価履歴
- （未着手）
