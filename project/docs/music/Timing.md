# Timing

---

## 1. 時間単位

- 論理時間: **beats**（4/4、1小節=4拍）
- 再生: サンプルクロック（bpm から変換）
- 仕様・プロファイルの人間可読単位: **ms** と **beats**

---

## 2. 現状の微タイミング

| 手法 | 用途 |
|---|---|
| `timingSway` | 決定論的な前後揺れ |
| `look` | upbeat の食い |
| strum delay | ノート順の微小ロール |
| jazzSwing | offbeat を `swingRatio` へ（`Swing.md`） |

---

## 3. スタイル基準（GT-001 校正後）

出典: `GroundTruthMidi.md` GT-001（125 BPM ピアノ）

### 3.1 グリッド感

- 16 分グリッドに対する onset オフセット **median ≈ 0 ms**（強クオンタイズ）
- Bass: mean ≈ 0、外れ ±11–13 ms  
- Mid: mean ≈ **+2 ms**（わずかに後ろ）、外れ ±40–52 ms は稀  

→ 基本はオングリッド。Humanize の timing 量は **小さく**（`Humanize.md`）。

### 3.2 ピアノ声部相対（クラスタ内）

| 関係 | 計測 | 運用目安 |
|---|---|---|
| Body − Bass | median 0 / p75 **+4 ms** / mean **+2 ms** | コードを 0–4 ms 後ろ可 |
| ストラム spread | median 0 / mean **3.2 ms** / p75 **6.5 ms** | **0–7 ms** 帯が主。旧 +8/+15 は強すぎ |
| 低音先打ち比 | **0.44** | 低音先行を強制しない |

### 3.3 ドラム（未計測・仮置き）

GT-001 は Piano のみ。ドラム表は GMD / 次 GT で校正。暫定:

| Voice | オフセット目安 |
|---|---|
| Kick | −5 ms |
| Snare | +8 ms |
| Hat | ±10 ms |

変換: `offsetBeats ≈ offsetMs / (60000 / bpm)`。

---

## 4. 目標パラメータ

| パラメータ | 意味 | GT-001 示唆 |
|---|---|---|
| `swingRatio` | `Swing.md` | **0.5**（ストレート） |
| `timingBiasBeats` | 全体前後 | ≈ 0 |
| `strumMs` | ロール | **3–7**（旧 12/5 は block/8th で見直し） |
| pattern `look` | 食い | 16 分シンコペと併用（過度にしない） |

---

## 5. 正解 MIDI

本数値は GT-001 優先。追加 GT で上書きする。  
