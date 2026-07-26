# Velocity

---

## 1. スケール

- MIDI velocity: 0–127  
- 内部正規化ゲイン: 0.0–1.0（native 伴奏）

---

## 2. 現状

- エディタ配置イベントは default **100** 固定に近い
- 伴奏はパターン内 `CompStroke.vel` × humanize × イベント vel
- ドラムはパターン定数 vel（soul16 ghost=0.3 等）
- Sampler は vel-layer なし（gain 近似）

---

## 3. スタイル基準（GT-001 校正後）

拍役割の帯域は `Accent.md` を正とする。要約（Reo / 日もすがら Piano）:

| 役割 | MIDI | gain 目安 |
|---|---|---|
| Downbeat | 68–83（median 75） | 0.53–0.65 |
| Upbeat | 63–77（median 71） | 0.50–0.61 |
| 16 分裏 | 63–77（median 70.5） | 0.50–0.61 |
| Ghost | 35–55 | 0.28–0.43 |

---

## 4. 仕様目標（層）

| 層 | 役割 |
|---|---|
| Event velocity | ユーザー/ダイナミクス曲線 |
| Pattern velocity | パターンの強拍・弱拍形状 |
| Accent profile | 拍・声部ごとの強調係数 |
| Humanize | 決定論的な微小揺らぎ（別文書） |

正解 MIDI から蓄積する特徴:

- 強拍/弱拍比、ghost 比率、クレッシェンド傾向  
- **具体ノート列は保存しない**（`GroundTruthMidi.md`）
