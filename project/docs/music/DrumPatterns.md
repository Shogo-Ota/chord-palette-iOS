# DrumPatterns

---

## 1. Voice

`kick` | `snare` | `hatClosed` | `hatOpen` | `ride` | `rim`

---

## 2. 現状 Groove 要約

| GrooveId | 特徴 |
|---|---|
| pop8 / pop8-min | 1&3 kick, 2&4 snare, 8分 HH |
| pop16 | + syncopated kick, 16分 HH |
| rock8 / rock16 | 強め vel |
| soul16 | syncopation + **ghost snare** |
| jazzSwing | ride 三連感、feather kick |
| bossaNova | surdo kick + rim clave |

---

## 3. Hit 記述（実装）

正本（TS）: `src/lib/performance/groove/drumProfiles.ts`  
例（soul16 ghost）:

```ts
{ beat: 1.75, voice: 'snare', vel: 0.3, tags: ['ghost'] }
```

Accent / Ghost は vel と tags で表現。ドラムと伴奏の同期は `src/lib/performance/groove/lockToGroove.ts`。

---

## 4. マイクロタイミング基準（初期値）

| Voice | オフセット目安 | 備考 |
|---|---|---|
| Kick | −5 ms | やや前ノリ |
| Snare | +8 ms | やや後ろ |
| Hat | ±10 ms | 揺れ幅 |

詳細は `Timing.md`。正解 MIDI 解析で上書きする。

---

## 5. データソース

| 優先 | ソース | 用途 |
|---|---|---|
| 1（最終教師） | オーナー正解 MIDI（`GroundTruthMidi.md`） | J-POP / シティポップ方向のノリ |
| 2（土台） | Groove MIDI Dataset（CC BY 4.0、帰属表示） | 一般的な人間演奏の統計 |
| 参考 | Magenta 概念 / pretty-midi 等 | 抽出手法 |

抽出物: スタイル特徴のみ（生 MIDI フレーズの製品同梱はしない）
