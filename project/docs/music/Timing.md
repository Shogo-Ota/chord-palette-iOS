# Timing

---

## 1. 時間単位

- 論理時間: **beats**（4/4、1小節=4拍）
- 再生: サンプルクロック（bpm から変換）
- JS `schedule.ts` は拍↔サンプルの純関数ミラー。実伴奏展開は native

---

## 2. 現状の微タイミング

| 手法 | 用途 |
|---|---|
| `timingSway` | 決定論的な前後揺れ |
| `look` | upbeat の食い |
| strum delay | ノート順の微小ロール |
| jazzSwing ride | offbeat を 2/3 拍位置へ |

一般化 `swingAmount`（0–1）は **未実装**。

---

## 3. 目標パラメータ

| パラメータ | 意味 |
|---|---|
| `swingRatio` | ストレート(0.5)〜三連(0.66…) |
| `pushPull` | 全体の前乗り/後ろ乗り（beats） |
| `strumMs` | ロール量 |
| `ghostOffset` | ghost の微小ズレ |

Piano と Drum で同じ `swingRatio` を共有できる設計にする。
