# ローカル保存構成（git 外）

- 版: v1.0（2026-08-03）
- Source MIDI と生の解析キャッシュはリポジトリに入れない（`.gitignore` 済み）。

## 推奨レイアウト

リポジトリの**外**、またはリポジトリ直下でも ignore されるパス:

```text
LocalDatasets/
├── AccompanimentMidi/          # 伴奏用 MIDI（新方式の正）
│   └── PianoMidiCollection/
├── Manuals/                    # マニュアル PDF
├── ReferenceAudio/             # 付属 WAV（任意）
├── Instruments/                # ローカル試聴用 SF2
│   ├── GrandPiano/
│   └── ElectricPiano/
└── CommercialSongMidi/         # 市販曲 MIDI（参考のみ・製品 Energy 根拠にしない）
    ├── Ballad/
    ├── Band/
    ├── City/
    ├── Dance/
    └── RnB/

LocalAnalysis/
├── accompaniment_patterns/  # 伴奏MIDI → 相対パターン（新方式）
├── song_features/           # MEASURED_SONG JSON（schema: song_analysis.schema.json）
├── event_cache/             # 中間イベント（任意・肥大化しがち）
├── reports/                 # 人間向けレポート下書き
└── comparison/              # Aggregate / Design Target 比較用
```

伴奏 MIDI 転用の詳細: [`docs/performance/accompaniment_midi_retarget.md`](../performance/accompaniment_midi_retarget.md)

Windows 例（オーナー環境）:

```text
C:\AI Works\Chord Palette\LocalDatasets\CommercialSongMidi\Ballad\
C:\AI Works\Chord Palette\LocalAnalysis\song_features\
```

いずれも git 管理外。

## リポジトリ内に置いてよいもの

```text
docs/song_analysis/           # 方針・スキーマ・空の枠
docs/style_datasets/          # Reference Songs 曲名
docs/performance/...          # DESIGN_TARGET / App 向け統計（原曲非復元）
```

## 受領時のファイル名推奨

```text
LocalDatasets/CommercialSongMidi/Ballad/<registryId>__short-slug.mid
```

台帳の `file` または本パイプライン用パスと一致させる。
