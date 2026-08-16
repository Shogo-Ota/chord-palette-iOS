# Playback 信号経路（v2 / Realtime Sampler）

v1 の監査は `docs/audio/playback_signal_path_before.md`。この文書は新経路が「何を通し、何を通さないか」を層別に記述する。実装は `modules/chord-audio/ios/RealtimeSamplerEngine.swift` と `src/lib/playback/`。

## 経路

```
FinalMidiSnapshot (TS)
  └─ buildNativePlaybackPlan          … 単一の変換点
       ├─ writeSmf(includeProgramChange: false)  … SMF Format 1 バイト列
       ├─ signature                              … Final MIDI の指紋
       └─ hasDrums / gmProgram / totalBeats / loop / startBeat
            └─ PlaybackRequest.smfBase64 → ChordAudioModule.play
                 └─ AudioEngineController.playRealtime
                      └─ RealtimeSamplerEngine.loadPlan / play
                           └─ AVAudioSequencer  … Apple のスケジューラ（オーディオクロック駆動）
                                ├─ track(s) → AVAudioUnitSampler（旋律: piano / e.piano）
                                └─ last track → AVAudioUnitSampler（打楽器バンク）
                                     └─ chordMixer / drumMixer → mainMixer → AUPeakLimiter → output
```

MIDI 書き出しは同じ `FinalMidiSnapshot` から `writeSmf`（program change あり）で作る。両者の差は program change の 1 イベントだけで、音楽的な内容は同一。これはテストで担保している（`src/lib/playback/__tests__/nativePlaybackPlan.test.ts`）。

## 層別

### 1. buildNativePlaybackPlan（TS, 純粋）

| 項目 | 挙動 |
| --- | --- |
| Input | `FinalMidiSnapshot` |
| Output | `NativePlaybackPlan`（SMF base64 + トランスポート情報 + 指紋） |
| Pitch / Velocity / Timing / Duration | 変更なし。SMF の tick 解像度（480 PPQ）に丸めるのみ |
| CC64 | **そのまま運ばれる**（v1 では欠落していた） |
| Tempo / TimeSignature | SMF のメタイベントとして運ばれる。ネイティブはテンポを推測しない |
| Program change | **意図的に含めない**。どのプリセットを鳴らすかはネイティブが決める |
| Drum | チャンネル 9 のトラックとして運ばれる。`hasDrums` で経路を明示 |

パターン・コード・教師 MIDI の出自を一切見ない。新しい Human MIDI Template を追加してもこの層は変更不要。

### 2. RealtimeSamplerEngine（Swift）

| 項目 | 挙動 |
| --- | --- |
| Velocity | MIDI velocity をそのままサンプラーへ送る。SF2 に velocity 層があれば音色が変わる |
| Sample lifetime | 制限なし。ノートオフまでサンプラーが鳴らし、release は SF2 のエンベロープ |
| 音域 | 制限なし。クランプしない |
| Stereo | サンプラー出力をステレオのままミキサーへ。ダウンミックスしない |
| CC64 | シーケンサからサンプラーへ MIDI コントローラとして届く。ペダル挙動はサンプラーの実装 |
| Polyphony | サンプラー任せ。自前の上限もボイス間引きもない |
| Clipping | 自前の `tanh` を通らない。マスターの `AUPeakLimiter` のみ（安全網） |
| Gain 構造 | サンプラーの `masterGain` を chord −6dB / drum −8dB に設定。**v1 は音量を 2 回掛けている**（レンダリング時のゲイン + ミキサーの `outputVolume`）ため、同じスライダー位置でも v2 の方が大きい。通常演奏でリミッタが動作しない範囲に収めるための保守的な初期値で、実機でリミッタの作動を確認してから調整する |
| 音色切替 | `loadSoundBankInstrument` 1 回。同一 instrument + program なら何もしない |
| ロード失敗 | `lastError` に理由・instrument id・program・パスを記録し、JS 診断へ出す。別の音へ差し替えない |

### 3. トランスポート

| 操作 | v2 の実装 |
| --- | --- |
| play | `currentPositionInBeats = startBeat` → `prepareToPlay()` → `start()` |
| pause | `stop()`（位置は保持）+ all notes off |
| resume | `start()` |
| stop | `stop()` + 位置 0 + **CC64 off / all notes off / all sound off を全チャンネル** |
| seek | `currentPositionInBeats` への代入 |
| loop | 各 `AVMusicTrack` の `loopRange = 0..<totalBeats`, `isLoopingEnabled = true` |
| 再生ヘッド | `currentPositionInBeats` をループ長で折り返して JS へ通知（UI 用途のみ） |
| 終端検知 | 非ループのプランが終端を越えたら v1 と同じく `stopped` を通知 |
| 音色ホットスワップ | サンプラーへ SF2 をロードするだけ。トランスポートは止まらない |
| プレビュー（コードタップ） | シーケンサを介さず同じサンプラーへ `startNote` / `stopNote` |

### 4. 変えていないもの

- ミキサー構成（chord / drum / master + `AUPeakLimiter`）。既存の音量設定がそのまま効く
- 動画書き出しのオフラインレンダリング。**v1 経路のまま**。共有するのは `FinalMidiSnapshot` までとし、リアルタイム再生と一本化しない（`docs/audio/playback_engine_migration.md`）
- MIDI 書き出しの内容
- 生成層（Chord Resolver / Human Template / HarmonyGate / Voicing / Pattern / Drum 生成）と UI

## v1 の制約がどう消えるか

| v1 の制約 | v2 |
| --- | --- |
| velocity 層 1 つ | MIDI velocity をサンプラーへ直送。SF2 の層が効く |
| 3 秒で音が尽きる | 制限なし。ノートオフまで鳴る |
| 音域 24–84 のクランプ | クランプなし |
| モノラル | ステレオ維持 |
| CC64 が経路に存在しない | サンプラーへ直接届く |
| tanh による二重圧縮 | 自前ソフトクリップなし |
| 音色切替で 61 音の事前録音 | SF2 ロード 1 回 |
| 自前ポリフォニー上限 24 | サンプラー任せ |

## 実機で確認が必要な残件

コードでは確認できず、耳と実機でしか判定できないもの。

- FluidR3 の program 0 / 4 が実際に velocity 層を持つか（持たなければ「機械的」の残りは音源の限界。音源差し替えは Playback Engine の品質確認後）
- ループ境界でノートオフが取りこぼされないか（取りこぼすと音が伸び続ける）
- SF2 ロード中のグリッチ（`loadSoundBankInstrument` は同期処理）
- パーカッションバンク（`kAUSampler_DefaultPercussionBankMSB`）が FluidR3 に存在するか
