# Native Groove Bridge（準備）

TS Groove Engine（`src/lib/groove`）の compile 結果を Native 再生器へ渡す契約。

---

## 1. 方針

| 項目 | 決定 |
|---|---|
| 単位 | **拍 (beats)** — sampleRate 非依存 |
| 適用 | Piano accompaniment strikes（Drum は当面 id のまま） |
| 互換 | `chordStrikes` が空/省略 → Native が従来どおり `buildChordStrikes` |
| 有効化 | **EAS Development/Production 再ビルド後**に新経路が動く |

```text
session / export
  → compilePianoBeatStrikes (TS)
  → PlaybackRequest.chordStrikes: BeatStrike[]
  → ChordAudioModule
  → frames = startBeat * framesPerBeat(bpm, deviceSR)
  → PlanSnapshot.chordStrikes
  → render (再生のみ)
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

## 3. フォールバック

1. JS が strikes を付けて送る（新 Dev Client）  
2. 古い Native は未知フィールドを無視 → 従来 compile（安全）  
3. 新 Native + strikes 空 → 従来 compile  
4. 新 Native + strikes 非空 → **TS 結果を採用**（Swift 内 build をスキップ）

---

## 4. 未配線（次々段）

- Drum hits の TS→Native 受け渡し（現状 `drumPatternId` のみ）
- GrooveProfile 全体の受け渡し
- Swift `buildChordStrikes` の削除（十分な実機検証後）
