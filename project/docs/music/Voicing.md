# Voicing

---

## 1. 現状（As-Is）

- ルートポジション・クローズド・固定レジスタ
- Body: C3 帯（root MIDI = 48 + pc）
- Bass: C1+C2 二重（slash 時は bass PC）
- inversion / drop / voice leading: **未実装**

---

## 2. 目標（To-Be）

| 段階 | 内容 |
|---|---|
| V1 | 定義 `intervals` の忠実な MIDI 化 + レジスタクランプ |
| V2 | 簡易 voice leading（共通音保持・最短移動） |
| V3 | drop2/drop3、テンション省略ルールの選択 |

---

## 3. ルール

1. 構成音のピッチクラスは定義と一致（バスは別）  
2. テンション過多時の省略は **定義側または voicing profile** で明示し、黙って落とさない  
3. Bass トラック分離後も、ピアノ内 bass 層（midi&lt;48）との互換しきい値を仕様化する  
4. 伴奏パターンは voicing 結果を入力とし、理論を再計算しない  

---

## 4. 知識蓄積

曲解析から得るのは具体 MIDI コピーではなく:

- 平均音域、密集/開離、テンションの残し方、トップノート傾向

→ 声部配置の実装正本は `src/lib/performance/voiceLeading.ts` と `src/lib/voicingColor.ts`。
