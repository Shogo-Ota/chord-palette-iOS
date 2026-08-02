# Native Groove Bridge（準備）

TS Groove Engine（`src/lib/groove`）の compile 結果を Native 再生器へ渡す契約。

---

## 1. 方針

| 項目 | 決定 |
|---|---|
| 単位 | **拍 (beats)** — sampleRate 非依存 |
| 適用 | Piano accompaniment strikes **＋ Drum hits** |
| 互換 | `chordStrikes` / `drumHits` が空/省略 → Native が従来どおり自前展開 |
| 有効化 | **EAS Development/Production 再ビルド後**に新経路が動く |

```text
session / export
  → compilePianoBeatStrikes (TS)         → PlaybackRequest.chordStrikes: BeatStrike[]
  → buildDrumHitsPayload(grooveId) (TS)  → PlaybackRequest.drumHits: DrumHit[]
  → ChordAudioModule
  → chord: frames = startBeat * framesPerBeat(bpm, deviceSR) → PlanSnapshot.chordStrikes
  → drum : voice string → DrumVoiceKind (off audio thread)  → PlanSnapshot.drumHits
  → render (再生 / 書き出し共通)
```

---

## 2. BeatStrike 契約

```ts
type BeatStrike = {
  startBeat: number;      // timing sway 適用後
  durationBeats: number;  // ringCap 後
  note: number;           // MIDI
  gain: number;           // 0..1 (humanize × event vel 済)
};
```

Swift Record フィールド名は同一（camelCase）。

---

## 3. DrumHit 契約

```ts
type DrumHitPayload = {
  beat: number;   // 4/4 小節内の位置 (0..4)
  voice: string;  // 'kick'|'snare'|'hatClosed'|'hatOpen'|'ride'|'rim'
  vel: number;    // 0..1
};
```

- `buildDrumHitsPayload({ grooveId })` が `getDrumPattern(grooveId).hits` を 1 小節ぶん出力（`tags` は落とす）。
- 単位は **小節内の拍**。Native は再生フレームを小節へ畳み込み（`beatInBar`）、`voice` の one-shot を**自前合成**する（スケジュールのみ TS 由来）。
- Swift 側：`voice` 文字列 → `DrumVoiceKind`（audio thread 外で解決）→ `PlanSnapshot.drumHits: [DrumVoiceHit]`。
- `SynthDrumProvider.sample(hits:beatInBar:secondsPerBeat:frame:)` が明示ヒット列で合成。空なら従来どおり `sample(groove:...)` が id からパターン展開。
- 再生と書き出し（`renderToFile`）で同一経路を使う。

---

## 4. フォールバック

1. JS が strikes / drumHits を付けて送る（新 Dev Client）  
2. 古い Native は未知フィールドを無視 → 従来展開（安全）  
3. 新 Native + 配列が空 → 従来展開（chord: `buildChordStrikes` / drum: `drumPatternId` 展開）  
4. 新 Native + 配列が非空 → **TS 結果を採用**（Swift 内 build / id 展開をスキップ）

---

## 5. 未配線（次々段）

- GrooveProfile 全体の受け渡し
- Swift `buildChordStrikes` / `SynthDrumProvider.pattern(for:)` の削除（十分な実機検証後）
