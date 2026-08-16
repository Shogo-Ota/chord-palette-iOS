# Ballad 演奏 MIDI 収録仕様（v0）

- 作成日: 2026-08-03
- 状態: **収録仕様のみ。MIDI の作成・取得はまだ行わない。**
- 上位: 教師データ監査後の次工程指示 / `docs/midi_dataset_policy.md`
- データ三区分の位置づけ:
  - 本仕様で収録する MIDI → **Measured Performance Data**（実測）の候補
  - `docs/style_datasets/ballad_teacher.md` の曲目 → **Reference Songs**（参考曲。実測ではない）
  - `docs/engine_specs/ballad_engine_spec.md` および現行エンジン数値 → **Engine Design Values**（設計値。本収録完了までは MEASURED ではない）

---

## 1. 目的

Ballad Engine に初めて接続する実データの収録条件を固定する。

- Chord Palette 用の**オリジナル伴奏**として演奏する（特定楽曲のコピー採譜は禁止）
- 完全クオンタイズしない人間演奏を残し、後で Humanize Profile / LibraryPattern へ統計・相対化する
- 元 MIDI はアプリに収録しない（`docs/midi_dataset_policy.md`）

---

## 2. 固定コード進行

すべて 1 コード = 1 小節（4/4）、キー C 基準。進行はループして 4〜8 小節以上演奏する。

| ID | 進行 | 用途 |
|---|---|---|
| P1 | C – G – Am – F | ダイアトニック基本（I–V–vi–IV） |
| P2 | Cmaj7 – Am7 – Dm7 – G7 | セブンス色・バラード定番 |
| P3 | Am – F – C – G | 短調始まりの循環 |
| P4 | Dm7 – G7 – Cmaj7 – A7 | II–V–I 系＋セカンダリ |

コード枠（相対化時の手動 annotation 用）:

| ID | rootPc 列（C=0） | chordIntervals 例 |
|---|---|---|
| P1 | 0, 7, 9, 5 | `[0,4,7]` / `[0,4,7]` / `[0,3,7]` / `[0,4,7]` |
| P2 | 0, 9, 2, 7 | `[0,4,7,11]` / `[0,3,7,10]` / `[0,3,7,10]` / `[0,4,7,10]` |
| P3 | 9, 5, 0, 7 | `[0,3,7]` / `[0,4,7]` / `[0,4,7]` / `[0,4,7]` |
| P4 | 2, 7, 0, 9 | `[0,3,7,10]` / `[0,4,7,10]` / `[0,4,7,11]` / `[0,4,7,10]` |

---

## 3. BPM

各進行 × 各パターンについて、次の 3 テンポで収録する。

| BPM | 想定 |
|---|---|
| 70 | 遅いバラード |
| 90 | 中庸バラード（Baseline 比較の中心テンポ） |
| 110 | 速めのバラード境界 |

テンポは演奏前に DAW / メトロノームで固定し、MIDI の Tempo メタに記録する。途中のテンポ変化は v1 では行わない。

---

## 4. 演奏パターン（Pattern Type）

| Pattern Type ID | 内容 | 左手 | 右手 |
|---|---|---|---|
| `block` | ブロックコード | ルート（＋任意で5度） | 3〜4声の和音を拍頭付近で置く |
| `arp_slow` | ゆっくりしたアルペジオ | ルート保持 or 低音アルペ | 低→高にゆっくり分散 |
| `arp_8th` | 8分音符アルペジオ | ルート／単純な低音 | 8分で分散 |
| `lh_root_rh_chord` | 左手ルート＋右手コード | 主にルート | 和音（アルペなし） |
| `sparse` | 余白の多い伴奏 | 疎 | 疎。休符を意図的に残す |
| `dense_chorus` | サビ想定・密度高め | やや動く | 再打鍵・内声増。ただし特定曲のリフ禁止 |

合計マトリクス（目安）:

- 4 進行 × 3 BPM × 6 パターン × **2〜3 テイク** = **144〜216 ファイル**
- 初回バッチは縮小可: **P1 + P2** × **70/90** × **block / arp_slow / sparse** × **2 テイク** = 24 ファイル（最小接続セット）

---

## 5. 必須保存情報

各テイクの MIDI および台帳メタに、以下を必ず残す。

| 項目 | MIDI 内 | 台帳 / サイドカー |
|---|---|---|
| Note On | ✓（velocity > 0） | — |
| Note Off | ✓（or Note On vel 0） | — |
| Velocity | ✓ | — |
| Sustain Pedal | ✓ CC64（使用時。未使用でも「なし」と記録） | `annotation.tags` に `pedal` / `no-pedal` |
| Tempo | ✓ Set Tempo メタ | `annotation.bpmRange`（単一値なら min=max） |
| Time Signature | ✓（4/4） | `annotation.timeSignature` |
| Track | ✓ トラック分離推奨 | — |
| Left / Right Hand | トラック名 `LH` / `RH`、またはチャンネル分け | `annotation.tags` |
| Pattern Type | — | 必須（上表の ID） |
| Performance Take | — | `take: 1\|2\|3` |
| Performer | — | `rights` / サイドカー `performer` |
| License Status | — | `rights.verificationStatus` + `licenseType`（自作なら `自作` / `original`） |

ファイル命名案（git 外 `assets_dev/midi_teacher/ballad/`）:

```text
ballad_{pattern}_{progressionId}_bpm{bpm}_take{n}_{performer}.mid
例: ballad_block_P1_bpm90_take1_owner.mid
```

---

## 6. 収録条件（必須）

1. **完全クオンタイズしない**（グリッド吸着オフ、または軽いのみで人間のずれを残す）
2. **ベロシティを固定しない**（一定値ペイント禁止）
3. **4〜8 小節以上**演奏する（1 進行を最低 1 周、できれば 2 周）
4. **同じ条件を 2〜3 テイク**取る（再現性とばらつきの両方を残す）
5. **特定楽曲のメロディ・リフ・イントロを再現しない**
6. **Chord Palette 用のオリジナル伴奏として演奏する**
7. メトロノームは聴いてよいが、クリック音は MIDI に含めない
8. ピアノ音色で録音してよいが、解析対象は MIDI イベントのみ（音声は任意・参考）

---

## 7. 権利・台帳への登録

収録後（別フェーズ）に `docs/style_datasets/midi_registry.json` へ 1 ファイル 1 エントリで登録する。

- `sourceType`: `original`
- `style`: `ballad`
- `instrumentRole`: `piano`（LH/RH を分けた場合も親エントリは piano。将来 role 分割可）
- `rights.verificationStatus`: 自作確認後 `verified`
- `rights.derivativeUseAllowed`: `true`（アプリ派生利用のため）
- `annotation`: §2 のコード枠・拍子・小節数・BPM・`rhythmFeel: straight`・tags（pattern / take / pedal）

詳細スキーマ追加項目は `docs/data_collection/post_audit_next_steps.md` §6 を参照。

---

## 8. 解析側の前提（収録時の注意）

現行 `src/lib/performance/library/ingest/smf.ts` は Note / Tempo / Time Signature を読む。  
**CC64（サスティン）は現状スキップされる**ため、ペダル研究を行う場合は解析器拡張が別タスクになる。収録時はそれでも CC64 を必ず残す（将来 MEASURED 化のため）。

相対化（`relativize.ts`）はコードトーン以外を除外する。意図的な経過音は v1 では統計側で扱う想定。

---

## 9. やらないこと（本仕様の範囲外）

- Reference Songs（First Love 等）の採譜
- 市販曲 MIDI の収集
- 本仕様時点での MIDI ファイル作成
- Engine Design Values の書き換え
- アプリへの Humanize Profile 統合

---

## 10. 完了条件（収録フェーズに入るとき）

1. 本仕様の進行・BPM・パターン・必須メタがオーナー承認済み
2. 演奏環境（DAW / MIDI キーボード等）が用意できている
3. 最小セット（§4 の 24 ファイル案）から収録を開始できる
