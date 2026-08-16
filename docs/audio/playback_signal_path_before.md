# Playback 信号経路（v1 / 現行）— 層別監査

`FinalMidiSnapshot` から音が出るまでの各層について、**コードを読んで確認できた事実**のみを記録する。推測は「仮説」と明記する。監査対象は HEAD `1b154de` + 作業ツリー（v1.02 作業中）。

対応する計測は `npm run audition` と `npm run audition:playback` で再現できる。

## 経路の全体

```
FinalMidiSnapshot (TS)
  └─ playbackAccompanimentNotes / performanceMapper.mapPerfNotesToPlaybackRequest
       └─ PlaybackRequest.chordEvents  … 同時発音を 1 イベントにまとめた NoteEvent[]
            └─ ChordAudioModule.play  (Expo Module bridge)
                 └─ AudioEngineController.play → buildChordStrikes → [NoteStrike]
                      └─ AVAudioSourceNode renderChord (audio thread)
                           └─ InstrumentProvider.sample(note:tSeconds:durationSeconds:)
                                └─ SampledInstrumentProvider … 事前録音 PCM の読み出し
                                     └─ tanh → chordMixer → mainMixer → AUPeakLimiter → output
```

ドラムは別系統（`DrumProvider` / `SampledDrumProvider` + ネイティブ `DrumKit.swift` のパターン定義）。`FinalMidiSnapshot` のドラムノートは**再生には使われず**、MIDI / 動画書き出しにのみ使われる。同じパターンを TypeScript と Swift の二箇所で定義している。

## 層別

### 1. performanceMapper（TS）

| 項目 | 事実 |
| --- | --- |
| Input | `NoteEvent[]`（Performance Engine 出力、`chord` / `top` / `bass` トラック） |
| Output | `PlaybackRequest`（`chordEvents`, bpm, totalBeats, loop, drumPatternId, instrument, drumMode） |
| Pitch | 変更なし |
| Velocity | 変更なし |
| Timing | 変更なし |
| Duration | 変更なし |
| CC64 | **落ちる**。`PlaybackRequest` に CC を運ぶフィールドが存在しない |
| Marker | 落ちる（再生に不要） |

CC64 が再生経路に存在しないことは実装上の事実。`InstrumentEffect` の「サステイン」がノート長の延長として実装されているのはこの制約への対処。

### 2. ChordAudioModule（bridge）

素の marshalling のみ。値の変換はない。

### 3. buildChordStrikes（Swift, 非オーディオスレッド）

| 項目 | 事実 |
| --- | --- |
| Input | `[NoteEventValue]`, bpm, accompaniment, sampleRate |
| Output | `[NoteStrike]`（`start`: フレーム, `dur`: フレーム, `note`: Int, `gain`: Float） |
| Pitch | `accompaniment == "performance"` では変更なし。それ以外の分岐（`emitGrid` / `emitGroup` / `CompStroke`）はネイティブ側で伴奏を再生成するレガシー経路で、現在の JS は常に `performance` を渡す |
| Velocity | `gain = Float(velocity) / 127.0` に変換される。**この時点で MIDI velocity という概念は消える** |
| Timing | `performance` では変更なし（`Scheduler.framesPerBeat` によるフレーム換算のみ） |
| Duration | フレーム数へ換算。以降 duration は「サンプルを何フレーム読むか」を意味する |

### 4. renderChord（オーディオスレッド）

| 項目 | 事実 |
| --- | --- |
| 発音 | 現在フレームに掛かる `NoteStrike` を線形に走査し、`provider.sample()` の戻り値に `strike.gain` を掛けて加算 |
| Polyphony | `maxChordPolyphony = 24`。超過分は**新しい打鍵を残し古い減衰を捨てる**（`cappedVoiceFrames` に計上） |
| Clipping | 加算後に `tanh(sum)`。さらにマスターに `AUPeakLimiter` |
| Stereo | `writeToAllChannels` が全チャンネルに同一値を書く。**左右同一 = モノラル** |
| CC64 | 参照されない |

### 5. SampledInstrumentProvider（音源）

ここが本質的な制約の発生源。`load(soundFontURL:program:)` の実装事実。

| 項目 | 事実 | 音への帰結 |
| --- | --- | --- |
| ロード方式 | `AVAudioUnitSampler` を**オフラインエンジン**に載せ、`lowNote = 24`〜`highNote = 84` の 61 音を 1 回ずつ発音して PCM を録音する | サンプラーはライブ経路に存在しない |
| Velocity 層 | 録音は `withVelocity: 100` 固定。1 音 = 1 波形 | 強弱で**音色が変わらない**。音量スケールのみ |
| Sample lifetime | `captureSeconds = 3.0`。`sample()` は `if idx >= len { return 0 }` | 3 秒を超えて保持した音が**途中で無音になる** |
| 音域 | `let clamped = min(max(note, 24), 84)` | 84 を超えるピッチが**別の音として鳴る**（最大 11 半音ずれを実測） |
| Stereo | ステレオで録音した後 `(left[i] + right[i]) * 0.5` でモノラル化。書き出しも左右同一 | 広がりが消える |
| Release | ノートオフは 30ms の直線フェード（`fade = 0.03`） | 自然な減衰・ダンパー挙動がない |
| 後処理 | DC ブロック、8ms アタックフェード、EP は 7kHz 一次ローパス | アタックが鈍る方向 |
| Gain | `gain = 0.6`（EP は 0.48） | ヘッドルームを固定値で確保 |
| ロード時間 | 音色切替ごとに 61 音 × 3 秒 + ウォームアップのオフラインレンダリング | 切替が重い |
| Pull モデル | エンジンが `sample(note:tSeconds:durationSeconds:)` を毎フレーム呼ぶ | サンプラー設計と逆。ポリフォニー・リリース・ペダルを自前で持つ必要が生じる |

### 6. E.Piano の音源解決

`resolveInstrumentProvider` は `soundFontForInstrument["ePiano"] = "Rhodes_MKII_Piano"` を名前完全一致で探す。見つからない、またはロード失敗のとき **`electricPianoProvider`（合成 EP）へ黙って落ちる**。JS には `sampledLoaded` と `lastLoadError` は出るが、「どの音源を探して失敗したか」は出ていなかった（本作業で `instrumentSoundFonts` を追加して可視化した）。

`Rhodes_MKII_Piano.sf2`（76MB）は **git 未追跡**。podspec が `soundfonts/*.sf2` を glob しているため、このマシンのビルドには入るが、クリーンチェックアウトのビルドには入らない。同じコミットから作ったビルドで E.Piano の音が変わるという再現性の問題がある。

## 実測（進行 C \| Am \| Fmaj7 \| G7 / 90BPM / Piano / Drum OFF / Type 1）

`LocalAnalysis/playback_regression/manifest.json` より。

| 固定パターン | ノート数 | 最大同時 | velocity 段階 | 3秒打ち切り | 音域クランプ | ユニゾン重複 |
| --- | --- | --- | --- | --- | --- | --- |
| block_type1 | 76 | 6 | 23 | 0 | 0 | 2 |
| ballad_type1 | 48 | 4 | 26 | 0 | **6** | 0 |
| arpeggio_type1 | 86 | 5 | 38 | 0 | 0 | 4 |

- バラードは 1 テイクあたり 6 音が音域クランプに掛かる。**この 6 音は意図と違う音高で鳴っている**
- 進行 D / 70BPM ではブロックで 4 音が 3 秒打ち切りに掛かる（テンポが遅いほど悪化）
- velocity は 23〜38 段階が生成されているが、音源側の層が 1 つなので**音色差としては再現されない**

## 症状と原因の対応（確定分）

| ユーザー報告 | 層 | 実装上の原因 |
| --- | --- | --- |
| 音色が変・安っぽい | 再生 | velocity 層 1 つ + モノラル + 事前録音 |
| 音が抜ける・途切れる | 再生 | 3 秒の打ち切り |
| コードの響きが違う | 再生 | 84 超のピッチのクランプ |
| ペラい | 再生 | tanh + リミッタの二重圧縮、モノラル |
| 機械的 | 生成 | テンプレートの onset が 16 分グリッドに量子化済み（`timingOffsetBeats` が全 0）。加えて再生側で強弱が音色に出ない |
| 薄い | 生成 | `top` トラックが Human Template 経路で消滅している |

生成側の 2 件は本作業の対象外（Playback Engine 完成後に切り分ける）。`docs/audio/sound_path_v1.md` に測定根拠を記録した。
