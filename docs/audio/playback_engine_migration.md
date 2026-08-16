# Playback Engine 移行計画（v1 → v2）

## 安全策（Phase 0）

- 監査時点の HEAD: `1b154deb0bffd1d2ac4568de752f90d15768b254`（`feat(performance): Ballad Baseline generator`）
- **本当のロールバックはフラグ**。v2 は既定で無効で、`PlaybackRequest.engine` が `sequencer` のときだけ通る。既定の `sampled` 経路のコードは 1 行も削っていない
- v1 のコードは v2 の品質確認が終わるまで残す
- 固定 Final MIDI は `LocalAnalysis/playback_regression/`（`npm run audition:playback` で再生成）。指紋が変われば生成層が変わったということなので、A/B の前提が崩れたと分かる

コード上のロールバック手順（v2 を捨てる場合）。

1. `src/services/audio/playbackEngine.ts` の `BUILD_DEFAULT` を `'sampled'` 固定にする（既定なので通常は何もしなくてよい）
2. それでも消したい場合の削除対象は追加ファイルのみ: `modules/chord-audio/ios/RealtimeSamplerEngine.swift`, `src/lib/playback/`, `src/services/audio/playbackEngine.ts`
3. 既存ファイルへの変更は追加のみ（`AudioEngineController` の `playRealtime` と各トランスポートの分岐、`ChordAudioModule` の追加フィールド、`smfWrite` のオプション、`playback.ts` の 1 行、SMF パーサの CC 収集）

## 変更ファイル

新規。

| ファイル | 役割 |
| --- | --- |
| `modules/chord-audio/ios/RealtimeSamplerEngine.swift` | v2 本体（サンプラー + シーケンサ） |
| `src/lib/playback/nativePlaybackPlan.ts` | `FinalMidiSnapshot` → ネイティブ入力の単一変換点 |
| `src/lib/playback/base64.ts` | ブリッジ用 base64（Hermes に `Buffer` がない） |
| `src/lib/playback/fixtures.ts` | A/B 用の固定進行と合成スナップショット |
| `src/lib/playback/__tests__/nativePlaybackPlan.test.ts` | Phase 4 客観検証 |
| `src/services/audio/playbackEngine.ts` | エンジン選択（診断用） |
| `src/lib/performance/analysis/playbackFidelity.ts` | v1 が再現できない音の定量化 |
| `scripts/audition/audition.harness.ts` | 設定別 .mid + 指標レポート |
| `scripts/audition/playbackRegression.harness.ts` | 固定 artifact 生成 |
| `docs/audio/*.md` | 監査・設計・A/B 手順 |

既存への変更（すべて追加方向）。

| ファイル | 変更 |
| --- | --- |
| `modules/chord-audio/ios/AudioEngineController.swift` | `playRealtime` の追加、transport / diagnostics / setInstrument / preview の v2 分岐、v2 サンプラーの attach |
| `modules/chord-audio/ios/ChordAudioModule.swift` | `PlaybackRequestRecord` に v2 フィールド、play の振り分け |
| `src/services/audio/types.ts` | `PlaybackRequest` の v2 フィールド、診断型の拡張 |
| `src/features/editor/playback.ts` | `withNativePlaybackPlan` の 1 行 |
| `src/lib/midiExport/smfWrite.ts` | `includeProgramChange` オプション |
| `src/lib/performance/library/ingest/smf.ts` | パーサが CC を収集（CC64 検証のため） |
| `src/app/listening-v101.tsx` | 管理者専用画面に A/B 切替（既存の型エラー 2 件も修正） |
| `package.json` | `audition` / `audition:playback` スクリプト |

## 段階

### 済（本作業）

1. Phase 0 安全策と固定 artifact
2. Phase 1 v1 の層別監査
3. Phase 2 v2 実装（TS 変換点 + ネイティブエンジン）
4. Phase 3 診断限定の A/B
5. Phase 4 客観検証（13 件）
6. Phase 5 音質比較用 artifact
7. Phase 7 トランスポート（stop 時の all notes off / CC64 off を含む）

### 次（実機が必要）

8. 実機 A/B。`docs/audio/playback_ab_test.md` の手順で OLD / NEW / DAW を比較
9. 判定が PASS なら v2 を既定へ（`EXPO_PUBLIC_PLAYBACK_ENGINE` ではなく `BUILD_DEFAULT` の変更）
10. Phase 8 動画書き出し。**v2 に寄せない**。`FinalMidiSnapshot` までを共通とし、オフラインレンダリングは v1 のまま維持する。リアルタイム再生の刷新で書き出しを壊さないことを優先する
11. Phase 6 Effect の再検討。v2 では CC64 がサンプラーに届くので、「サステイン」をノート長の延長で代替する必要がなくなる。ただし変更は Pitch / Velocity / Onset を触らない範囲に限る

### v2 確定後の掃除（一気にやらない）

1. `SampledInstrumentProvider` を deprecated 扱いにする（削除はしない）
2. 実機で 1 リリース分の運用を経てから、`InstrumentProvider` の pull モデル・`NoteStrike`・`tanh`・ネイティブのレガシー伴奏生成（`emitGrid` / `emitGroup` / `CompStroke`）を削除
3. 最後に `DrumKit.swift` と TypeScript ミラーの二重管理を解消（v2 は SMF のドラムノートを鳴らすので、パターン定義は TypeScript 側だけで足りる）

## SF2 衛生（未解決 / 要判断）

確認した事実。

| 項目 | 状態 |
| --- | --- |
| `FluidR3_GM2-2.SF2`（148MB） | git 追跡済み（LFS）。`.gitattributes` に `*.sf2` / `*.SF2` の LFS 指定あり |
| `Rhodes_MKII_Piano.sf2`（76MB） | **git 未追跡**。ライセンス・出所を示すファイルが repo 内に存在しない |
| bundle | `ChordAudio.podspec` が `soundfonts/*.sf2` を glob するため、このマシンのビルドには**入る**。クリーンチェックアウトのビルドには入らない |
| 未搭載時の v1 挙動 | `resolveInstrumentProvider` が合成 EP へ黙って落ちる（本作業で `instrumentSoundFonts` 診断を追加し、可視化した） |
| v2 の依存 | **依存しない**。v2 は GM バンクの program 4 を使うので、この asset が無くても同じ音になる |

判断が必要な点。ライセンスが未確認の 76MB バイナリを勝手にコミットも削除もしない。

1. 出所とライセンスを確認する（再配布可否・クレジット要否）
2. 可なら LFS でコミットし、`docs/` に出所とライセンスを記録する
3. 不可なら削除し、podspec の glob を `FluidR3_GM2-2.SF2` の明示指定に変える

いずれにせよ「同じコミットからビルドしたのに E.Piano の音が違う」状態は解消する必要がある。ただし podspec を今変えるとこのマシンの v1 E.Piano の音が変わる（= 出荷経路の音の変化）ため、A/B の判定前には触らない。

## 将来の Human MIDI Template 追加に対する条件

Playback Engine には次を入れない。

- 特定パターン / 特定コード / 特定教師 MIDI の分岐
- テンプレート id を見た挙動の切り替え
- パターンごとの音量・音域・ゲート補正

v2 が読むのは `FinalMidiSnapshot` から作った SMF と、それに付随するトランスポート情報だけ。テンプレートを何本追加しても、スナップショットが正しければ同じ品質で鳴る。この条件はテスト（`holds for every pattern, Type and effect the UI can select`）が守っている。
