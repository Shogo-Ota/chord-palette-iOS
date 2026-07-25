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

## 3. 仕様目標

| 層 | 役割 |
|---|---|
| Event velocity | ユーザー/ダイナミクス曲線 |
| Pattern velocity | パターンの強拍・弱拍形状 |
| Humanize | 決定論的な微小揺らぎ |
| Accent profile | 拍・声部ごとの強調係数 |

解析から蓄積する特徴例:

- 強拍/弱拍比、ghost 比率、クレッシェンド傾向、手の左右差（将来）
