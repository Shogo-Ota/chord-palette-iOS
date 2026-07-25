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

## 3. Hit 記述目標

```json
{ "beat": 1.75, "voice": "snare", "vel": 0.3, "tags": ["ghost"] }
```

Accent / Ghost は vel と tags で表現。Humanize は別プロファイルでオンセットと vel を微小変調。

---

## 4. データソース

- 開発時: Groove MIDI Dataset（CC BY 4.0、帰属表示）
- 抽出物: スタイル特徴のみ（生 MIDI フレーズの製品同梱はしない）
